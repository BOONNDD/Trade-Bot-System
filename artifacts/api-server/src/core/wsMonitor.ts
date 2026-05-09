import { EventEmitter } from "node:events";
import { writeLog } from "../logs/logManager.js";
import { ENV } from "../config/env.js";
import { getBackoffDelay, sleep, timestamp } from "../utils/helpers.js";
import { logger } from "../lib/logger.js";

export type WsStatus = "connected" | "disconnected" | "stale" | "reconnecting";

export interface WsStats {
  status: WsStatus;
  lastTickAt: Date | null;
  reconnectAttempts: number;
  totalReconnects: number;
  uptime: number;
}

// WebSocket self-healing monitor — watches for stale data and triggers reconnects
export class WsMonitor extends EventEmitter {
  private status: WsStatus = "disconnected";
  private lastTickAt: Date | null = null;
  private reconnectAttempts = 0;
  private totalReconnects = 0;
  private startTime = new Date();
  private staleCheckInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Called externally when a WebSocket tick/message is received
  onTick(): void {
    this.lastTickAt = new Date();
    if (this.status !== "connected") {
      this.setStatus("connected");
      this.reconnectAttempts = 0;
      writeLog("websocket", `✅ WebSocket connected — tick received at ${timestamp()}`);
    }
  }

  // Start monitoring for stale data
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    writeLog("websocket", "🔍 WS Monitor started");

    // Check for stale data every 10 seconds
    this.staleCheckInterval = setInterval(() => {
      this.checkStaleData();
    }, 10_000);

    // Heartbeat log every 5 minutes
    this.heartbeatInterval = setInterval(() => {
      this.emitHeartbeat();
    }, ENV.HEARTBEAT_INTERVAL_MS);
  }

  stop(): void {
    this.isRunning = false;
    if (this.staleCheckInterval) clearInterval(this.staleCheckInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.setStatus("disconnected");
    writeLog("websocket", "🛑 WS Monitor stopped");
  }

  // Check if data is stale — no ticks received for too long
  private checkStaleData(): void {
    if (!this.lastTickAt) return;

    const msSinceLastTick = Date.now() - this.lastTickAt.getTime();

    if (msSinceLastTick > ENV.STALE_DATA_TIMEOUT_MS && this.status === "connected") {
      writeLog(
        "websocket",
        `⚠️ Stale data detected — No tick for ${Math.round(msSinceLastTick / 1000)}s. Triggering reconnect.`
      );
      logger.warn({ msSinceLastTick }, "[WS] Stale data detected");
      this.setStatus("stale");
      this.triggerReconnect("STALE_DATA");
    }
  }

  // Trigger a reconnect with exponential backoff
  async triggerReconnect(reason: string): Promise<void> {
    if (this.status === "reconnecting") return;

    this.setStatus("reconnecting");
    this.reconnectAttempts++;
    this.totalReconnects++;

    const delay = getBackoffDelay(this.reconnectAttempts, ENV.RECONNECT_DELAY);

    writeLog(
      "reconnects",
      `🔄 Reconnect attempt #${this.reconnectAttempts} | Reason: ${reason} | Delay: ${delay}ms`
    );

    logger.info({ attempt: this.reconnectAttempts, delay, reason }, "[WS] Reconnecting");

    if (this.reconnectAttempts > ENV.MAX_RECONNECT_ATTEMPTS) {
      writeLog(
        "errors",
        `🚨 Max reconnect attempts (${ENV.MAX_RECONNECT_ATTEMPTS}) reached. Emitting FATAL event.`
      );
      this.emit("maxReconnectsReached");
      return;
    }

    await sleep(delay);
    this.emit("reconnect", reason);
  }

  private emitHeartbeat(): void {
    const stats = this.getStats();
    const msg = [
      `💓 Heartbeat | Status: ${stats.status}`,
      `Last tick: ${stats.lastTickAt ? stats.lastTickAt.toISOString() : "never"}`,
      `Reconnects: ${stats.totalReconnects}`,
    ].join(" | ");

    writeLog("runtime", msg);
    this.emit("heartbeat", stats);
  }

  private setStatus(status: WsStatus): void {
    this.status = status;
    this.emit("statusChange", status);
  }

  // Mark as connected externally (e.g. when Puppeteer page loads)
  markConnected(): void {
    this.onTick();
  }

  markDisconnected(): void {
    this.setStatus("disconnected");
    writeLog("websocket", `❌ WebSocket disconnected at ${timestamp()}`);
    this.triggerReconnect("DISCONNECT");
  }

  getStats(): WsStats {
    return {
      status: this.status,
      lastTickAt: this.lastTickAt,
      reconnectAttempts: this.reconnectAttempts,
      totalReconnects: this.totalReconnects,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }
}

export const wsMonitor = new WsMonitor();
