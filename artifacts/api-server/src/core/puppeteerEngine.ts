import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeLog } from "../logs/logManager.js";
import { ENV } from "../config/env.js";
import { sleep, timestamp } from "../utils/helpers.js";
import { wsMonitor } from "./wsMonitor.js";
import { logger } from "../lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(__dirname, "candle_V11_MAGNETAR.js");

export type EngineStatus = "idle" | "starting" | "running" | "crashed" | "stopped";

// Trading statistics tracked from console logs
interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  lastTradeAt: Date | null;
  lastSignal: string;
}

export class PuppeteerEngine extends EventEmitter {
  private browser: import("puppeteer").Browser | null = null;
  private page: import("puppeteer").Page | null = null;
  private status: EngineStatus = "idle";
  private startTime: Date | null = null;
  private consoleLogs: string[] = [];
  private tradeStats: TradeStats = {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    lastTradeAt: null,
    lastSignal: "NONE",
  };
  private freezeWatchdog: NodeJS.Timeout | null = null;
  private lastPageActivity = Date.now();

  async start(): Promise<void> {
    if (this.status === "running" || this.status === "starting") {
      writeLog("runtime", "⚠️ Engine already running — ignoring start request");
      return;
    }

    this.setStatus("starting");
    writeLog("runtime", `🚀 Starting Puppeteer engine at ${timestamp()}`);

    try {
      await this.launchBrowser();
      await this.loadPage();
      await this.injectScript();
      this.setupPageMonitoring();
      this.startFreezeWatchdog();
      this.setStatus("running");
      this.startTime = new Date();
      wsMonitor.start();
      writeLog("runtime", "✅ Puppeteer engine started successfully");
      this.emit("started");
    } catch (err) {
      this.setStatus("crashed");
      writeLog("errors", `❌ Engine start failed: ${err}`);
      logger.error({ err }, "[ENGINE] Failed to start");
      this.emit("crashed", err);
      await this.scheduleRestart();
    }
  }

  async stop(): Promise<void> {
    this.setStatus("stopped");
    wsMonitor.stop();
    if (this.freezeWatchdog) clearInterval(this.freezeWatchdog);

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore close errors
      }
      this.browser = null;
      this.page = null;
    }

    writeLog("runtime", `🛑 Puppeteer engine stopped at ${timestamp()}`);
    this.emit("stopped");
  }

  async restart(): Promise<void> {
    writeLog("runtime", "🔄 Restarting engine...");
    this.emit("restarting");
    await this.stop();
    await sleep(3000);
    await this.start();
  }

  // Launch headless Chromium browser
  private async launchBrowser(): Promise<void> {
    const puppeteer = (await import("puppeteer")).default;

    this.browser = await puppeteer.launch({
      headless: ENV.HEADLESS,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=IsolateOrigins",
        "--disable-site-isolation-trials",
        "--window-size=1280,720",
      ],
      userDataDir: ENV.SESSION_PATH,
      defaultViewport: { width: 1280, height: 720 },
    });

    this.browser.on("disconnected", () => {
      writeLog("errors", "⚠️ Browser disconnected unexpectedly");
      if (this.status === "running") {
        this.setStatus("crashed");
        wsMonitor.markDisconnected();
        this.scheduleRestart();
      }
    });

    writeLog("runtime", "🌐 Browser launched");
  }

  // Navigate to the trading platform
  private async loadPage(): Promise<void> {
    if (!this.browser) throw new Error("Browser not initialized");

    const pages = await this.browser.pages();
    this.page = pages[0] ?? await this.browser.newPage();

    // Set a realistic user agent
    await this.page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Intercept WebSocket frames for monitoring
    const client = await this.page.createCDPSession();
    await client.send("Network.enable");

    client.on("Network.webSocketFrameReceived", () => {
      this.lastPageActivity = Date.now();
      wsMonitor.onTick();
    });

    client.on("Network.webSocketClosed", () => {
      wsMonitor.markDisconnected();
    });

    writeLog("websocket", `🔌 Navigating to: ${ENV.TARGET_URL}`);
    await this.page.goto(ENV.TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    writeLog("runtime", "📄 Page loaded");
  }

  // Inject the MAGNETAR trading UserScript into the page
  private async injectScript(): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    let scriptContent: string;
    try {
      scriptContent = fs.readFileSync(SCRIPT_PATH, "utf8");
    } catch {
      throw new Error(`Cannot read UserScript at: ${SCRIPT_PATH}`);
    }

    // Strip the UserScript metadata header (// ==UserScript== ... // ==/UserScript==)
    const cleanScript = scriptContent
      .replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/m, "")
      .trim();

    // Wait for the page body to be ready
    await this.page.waitForSelector("body", { timeout: 30_000 });
    await sleep(2000);

    // Inject the script into the page context
    await this.page.evaluate((script) => {
      try {
        const fn = new Function(script);
        fn();
      } catch (e) {
        console.error("[INJECT] Script injection error:", e);
      }
    }, cleanScript);

    writeLog("trades", "💉 V11_MAGNETAR UserScript injected successfully");
    logger.info("[ENGINE] UserScript injected");
  }

  // Monitor page console output for trade signals and errors
  private setupPageMonitoring(): void {
    if (!this.page) return;

    this.page.on("console", (msg) => {
      const text = msg.text();
      const type = msg.type();
      const entry = `[PAGE:${type.toUpperCase()}] ${text}`;

      // Keep last 500 console messages in memory
      this.consoleLogs.push(`[${timestamp()}] ${entry}`);
      if (this.consoleLogs.length > 500) this.consoleLogs.shift();

      // Parse trade signals from console output
      if (text.includes("BUY") || text.includes("CALL")) {
        this.tradeStats.totalTrades++;
        this.tradeStats.lastTradeAt = new Date();
        this.tradeStats.lastSignal = "BUY";
        writeLog("trades", `📈 BUY Signal: ${text}`);
      } else if (text.includes("SELL") || text.includes("PUT")) {
        this.tradeStats.totalTrades++;
        this.tradeStats.lastTradeAt = new Date();
        this.tradeStats.lastSignal = "SELL";
        writeLog("trades", `📉 SELL Signal: ${text}`);
      } else if (text.includes("WIN") || text.includes("profit")) {
        this.tradeStats.wins++;
        writeLog("trades", `✅ WIN: ${text}`);
      } else if (text.includes("LOSS") || text.includes("loss")) {
        this.tradeStats.losses++;
        writeLog("trades", `❌ LOSS: ${text}`);
      } else if (type === "error") {
        writeLog("errors", `⚠️ Page error: ${text}`);
      }

      this.lastPageActivity = Date.now();
    });

    this.page.on("pageerror", (err: Error) => {
      writeLog("errors", `💥 Page JS error: ${err.message}`);
    });

    this.page.on("crash", () => {
      writeLog("errors", "💥 Page crashed!");
      this.setStatus("crashed");
      this.scheduleRestart();
    });
  }

  // Freeze watchdog — refreshes the page if no activity detected
  private startFreezeWatchdog(): void {
    const FREEZE_TIMEOUT_MS = 120_000; // 2 minutes

    this.freezeWatchdog = setInterval(async () => {
      const msSinceActivity = Date.now() - this.lastPageActivity;

      if (msSinceActivity > FREEZE_TIMEOUT_MS && this.status === "running") {
        writeLog(
          "errors",
          `🧊 Freeze detected — No activity for ${Math.round(msSinceActivity / 1000)}s. Refreshing page.`
        );
        this.emit("freeze");
        await this.refreshPage();
      }
    }, 30_000);
  }

  // Refresh the trading page without restarting the browser
  async refreshPage(): Promise<void> {
    if (!this.page) return;
    try {
      writeLog("runtime", "🔄 Refreshing trading page...");
      await this.page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
      await sleep(3000);
      await this.injectScript();
      this.lastPageActivity = Date.now();
      writeLog("runtime", "✅ Page refreshed and script re-injected");
    } catch (err) {
      writeLog("errors", `❌ Page refresh failed: ${err}`);
      await this.restart();
    }
  }

  // Schedule automatic restart after crash
  private async scheduleRestart(): Promise<void> {
    writeLog("reconnects", `⏳ Scheduling restart in ${ENV.RECONNECT_DELAY}ms...`);
    await sleep(ENV.RECONNECT_DELAY);
    await this.start();
  }

  private setStatus(status: EngineStatus): void {
    this.status = status;
    this.emit("statusChange", status);
  }

  // Get recent console logs
  getConsoleLogs(n: number = 50): string {
    return this.consoleLogs.slice(-n).join("\n") || "No logs yet.";
  }

  getStatus(): EngineStatus { return this.status; }
  getStartTime(): Date | null { return this.startTime; }
  getTradeStats(): TradeStats { return { ...this.tradeStats }; }

  // Take a screenshot of the current trading page
  async takeScreenshot(): Promise<Buffer | null> {
    if (!this.page) return null;
    try {
      const screenshot = await this.page.screenshot({ type: "png", fullPage: false });
      return Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
    } catch {
      return null;
    }
  }
}

export const puppeteerEngine = new PuppeteerEngine();

// Wire up ws monitor reconnect events to engine
wsMonitor.on("reconnect", async () => {
  await puppeteerEngine.refreshPage();
});

wsMonitor.on("maxReconnectsReached", async () => {
  writeLog("errors", "🚨 Max reconnects reached — restarting full engine");
  await puppeteerEngine.restart();
});
