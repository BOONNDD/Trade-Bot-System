import TelegramBot from "node-telegram-bot-api";
import fs from "node:fs";
import { ENV } from "../config/env.js";
import { puppeteerEngine } from "../core/puppeteerEngine.js";
import { wsMonitor } from "../core/wsMonitor.js";
import {
  clearAllLogs,
  exportLogsToFile,
  getLogStats,
  readLatestLogs,
  writeLog,
} from "../logs/logManager.js";
import {
  formatUptime,
  getCpuInfo,
  getMemoryInfo,
} from "../utils/helpers.js";
import { logger } from "../lib/logger.js";

let bot: TelegramBot | null = null;
const botStartTime = new Date();

// Send message safely (won't crash if Telegram is unavailable)
async function send(chatId: string, text: string): Promise<void> {
  if (!bot) return;
  try {
    await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  } catch (err) {
    logger.warn({ err }, "[BOT] Failed to send message");
  }
}

// Send file safely
async function sendFile(chatId: string, filePath: string, caption?: string): Promise<void> {
  if (!bot) return;
  try {
    await bot.sendDocument(chatId, filePath, { caption });
  } catch (err) {
    logger.warn({ err }, "[BOT] Failed to send file");
  }
}

// Send photo safely
async function sendPhoto(chatId: string, photo: Buffer, caption?: string): Promise<void> {
  if (!bot) return;
  try {
    await bot.sendPhoto(chatId, photo, { caption });
  } catch (err) {
    logger.warn({ err }, "[BOT] Failed to send photo");
  }
}

// Initialize the Telegram bot and register all commands
export function initTelegramBot(): TelegramBot | null {
  if (!ENV.TELEGRAM_TOKEN || !ENV.CHAT_ID) {
    logger.warn("[BOT] TELEGRAM_TOKEN or CHAT_ID not set — bot disabled");
    return null;
  }

  bot = new TelegramBot(ENV.TELEGRAM_TOKEN, { polling: true });
  const chatId = ENV.CHAT_ID;

  logger.info("[BOT] Telegram bot initialized");
  writeLog("runtime", "🤖 Telegram bot started");

  // ─── /start ───────────────────────────────────────────────────────────
  bot.onText(/\/start/, async () => {
    const msg = [
      "🧲 *V11 MAGNETAR — Trading Automation System*",
      "",
      "النظام جاهز للعمل. استخدم الأوامر التالية للتحكم:",
      "",
      "▶️ `/start` — تشغيل البوت",
      "📊 `/status` — حالة النظام",
      "🔄 `/restart` — إعادة تشغيل المحرك",
      "🛑 `/stop` — إيقاف المحرك",
      "📋 `/logs` — آخر سجلات التداول",
      "📤 `/export` — تصدير كل السجلات",
      "⏱ `/uptime` — مدة التشغيل",
      "💾 `/memory` — استخدام الذاكرة",
      "🏓 `/ping` — اختبار الاتصال",
      "📸 `/screenshot` — لقطة شاشة",
      "🔌 `/reconnect` — إعادة الاتصال",
      "♻️ `/reload` — إعادة تحميل الصفحة",
      "📈 `/profit` — إحصاء الصفقات الرابحة",
      "📉 `/loss` — إحصاء الصفقات الخاسرة",
      "🗑 `/clearlogs` — مسح السجلات",
    ].join("\n");

    await send(chatId, msg);
  });

  // ─── /status ──────────────────────────────────────────────────────────
  bot.onText(/\/status/, async () => {
    const engineStatus = puppeteerEngine.getStatus();
    const wsStats = wsMonitor.getStats();
    const mem = getMemoryInfo();
    const cpu = getCpuInfo();
    const uptime = formatUptime(botStartTime);
    const trades = puppeteerEngine.getTradeStats();

    const statusEmoji: Record<string, string> = {
      running: "🟢", starting: "🟡", idle: "⚪", crashed: "🔴", stopped: "🔴",
    };
    const wsEmoji: Record<string, string> = {
      connected: "🟢", disconnected: "🔴", stale: "🟡", reconnecting: "🟡",
    };

    const msg = [
      "📊 *حالة النظام — System Status*",
      "",
      `🤖 المحرك: ${statusEmoji[engineStatus] ?? "⚪"} \`${engineStatus}\``,
      `🔌 WebSocket: ${wsEmoji[wsStats.status] ?? "⚪"} \`${wsStats.status}\``,
      `⏱ وقت التشغيل: \`${uptime}\``,
      `💾 الذاكرة: \`${mem.used} / ${mem.total} (${mem.percent})\``,
      `🖥 المعالج: \`${cpu}\``,
      `🔄 إعادة الاتصال: \`${wsStats.totalReconnects}\` مرة`,
      `📈 صفقات BUY: \`${trades.totalTrades}\``,
      `✅ رابحة: \`${trades.wins}\` | ❌ خاسرة: \`${trades.losses}\``,
      `📡 آخر إشارة: \`${trades.lastSignal}\``,
    ].join("\n");

    await send(chatId, msg);
  });

  // ─── /restart ─────────────────────────────────────────────────────────
  bot.onText(/\/restart/, async () => {
    await send(chatId, "🔄 جاري إعادة تشغيل المحرك...\n_Restarting trading engine..._");
    writeLog("runtime", "🔄 Manual restart via Telegram");
    await puppeteerEngine.restart();
    await send(chatId, "✅ تمت إعادة التشغيل بنجاح!");
  });

  // ─── /stop ────────────────────────────────────────────────────────────
  bot.onText(/\/stop/, async () => {
    await send(chatId, "🛑 جاري إيقاف المحرك...\n_Stopping trading engine..._");
    writeLog("runtime", "🛑 Manual stop via Telegram");
    await puppeteerEngine.stop();
    await send(chatId, "✅ تم إيقاف المحرك");
  });

  // ─── /logs ────────────────────────────────────────────────────────────
  bot.onText(/\/logs/, async () => {
    const tradeLogs = readLatestLogs("trades", 30);
    const errLogs = readLatestLogs("errors", 10);

    const msg = [
      "📋 *آخر السجلات — Latest Logs*",
      "",
      "📈 *صفقات:*",
      "```",
      tradeLogs.substring(0, 1500),
      "```",
      "⚠️ *أخطاء:*",
      "```",
      errLogs.substring(0, 500),
      "```",
    ].join("\n");

    await send(chatId, msg);
  });

  // ─── /export ──────────────────────────────────────────────────────────
  bot.onText(/\/export/, async () => {
    await send(chatId, "📤 جاري تجميع وتصدير السجلات...\n_Exporting all logs..._");
    try {
      const filePath = await exportLogsToFile();
      await sendFile(chatId, filePath, "📊 تقرير السجلات الكامل — Full Log Export");
      // Clean up export file after sending
      fs.unlinkSync(filePath);
    } catch (err) {
      await send(chatId, `❌ فشل التصدير: \`${err}\``);
    }
  });

  // ─── /uptime ──────────────────────────────────────────────────────────
  bot.onText(/\/uptime/, async () => {
    const engineStart = puppeteerEngine.getStartTime();
    const botUp = formatUptime(botStartTime);
    const engineUp = engineStart ? formatUptime(engineStart) : "Not running";

    const msg = [
      "⏱ *وقت التشغيل — Uptime*",
      "",
      `🤖 البوت: \`${botUp}\``,
      `⚙️ المحرك: \`${engineUp}\``,
    ].join("\n");

    await send(chatId, msg);
  });

  // ─── /memory ──────────────────────────────────────────────────────────
  bot.onText(/\/memory/, async () => {
    const mem = getMemoryInfo();
    const cpu = getCpuInfo();

    const msg = [
      "💾 *إحصاءات الذاكرة — Memory Stats*",
      "",
      `🖥 الذاكرة المستخدمة: \`${mem.used} / ${mem.total}\``,
      `📊 النسبة: \`${mem.percent}\``,
      `🔧 Heap مستخدم: \`${mem.heapUsed} / ${mem.heapTotal}\``,
      `⚡ المعالج: \`${cpu}\``,
    ].join("\n");

    await send(chatId, msg);
  });

  // ─── /ping ────────────────────────────────────────────────────────────
  bot.onText(/\/ping/, async () => {
    const start = Date.now();
    await send(chatId, "🏓 Pong!");
    const latency = Date.now() - start;
    await send(chatId, `⚡ Latency: \`${latency}ms\``);
  });

  // ─── /screenshot ──────────────────────────────────────────────────────
  bot.onText(/\/screenshot/, async () => {
    await send(chatId, "📸 جاري التقاط الشاشة...\n_Taking screenshot..._");
    const screenshot = await puppeteerEngine.takeScreenshot();
    if (screenshot) {
      await sendPhoto(chatId, screenshot, "📸 لقطة شاشة لمنصة التداول");
    } else {
      await send(chatId, "❌ فشل التقاط الشاشة — المحرك لا يعمل");
    }
  });

  // ─── /reconnect ───────────────────────────────────────────────────────
  bot.onText(/\/reconnect/, async () => {
    await send(chatId, "🔌 جاري إعادة الاتصال بـ WebSocket...\n_Reconnecting WebSocket..._");
    writeLog("reconnects", "🔌 Manual reconnect via Telegram");
    await puppeteerEngine.refreshPage();
    await send(chatId, "✅ تمت إعادة الاتصال");
  });

  // ─── /reload ──────────────────────────────────────────────────────────
  bot.onText(/\/reload/, async () => {
    await send(chatId, "♻️ جاري إعادة تحميل الصفحة...\n_Reloading trading page..._");
    writeLog("runtime", "♻️ Manual page reload via Telegram");
    await puppeteerEngine.refreshPage();
    await send(chatId, "✅ تمت إعادة التحميل وإعادة حقن السكريبت");
  });

  // ─── /profit ──────────────────────────────────────────────────────────
  bot.onText(/\/profit/, async () => {
    const stats = puppeteerEngine.getTradeStats();
    const winRate = stats.totalTrades > 0
      ? ((stats.wins / stats.totalTrades) * 100).toFixed(1)
      : "0.0";

    const msg = [
      "📈 *الصفقات الرابحة — Winning Trades*",
      "",
      `✅ عدد الصفقات الرابحة: \`${stats.wins}\``,
      `📊 إجمالي الصفقات: \`${stats.totalTrades}\``,
      `🎯 نسبة الفوز: \`${winRate}%\``,
      `📡 آخر إشارة: \`${stats.lastSignal}\``,
    ].join("\n");

    await send(chatId, msg);
  });

  // ─── /loss ────────────────────────────────────────────────────────────
  bot.onText(/\/loss/, async () => {
    const stats = puppeteerEngine.getTradeStats();
    const lossRate = stats.totalTrades > 0
      ? ((stats.losses / stats.totalTrades) * 100).toFixed(1)
      : "0.0";

    const msg = [
      "📉 *الصفقات الخاسرة — Losing Trades*",
      "",
      `❌ عدد الصفقات الخاسرة: \`${stats.losses}\``,
      `📊 إجمالي الصفقات: \`${stats.totalTrades}\``,
      `📉 نسبة الخسارة: \`${lossRate}%\``,
      `📋 السجلات: /logs`,
    ].join("\n");

    await send(chatId, msg);
  });

  // ─── /clearlogs ───────────────────────────────────────────────────────
  bot.onText(/\/clearlogs/, async () => {
    writeLog("runtime", "🗑 Logs cleared via Telegram");
    clearAllLogs();
    await send(chatId, "🗑 تم مسح جميع السجلات بنجاح!\n_All logs cleared successfully!_");
  });

  // ─── Handle unknown commands ──────────────────────────────────────────
  bot.on("message", async (msg) => {
    if (msg.text && msg.text.startsWith("/") && msg.chat.id.toString() === chatId) {
      const known = [
        "/start", "/status", "/restart", "/stop", "/logs", "/export",
        "/uptime", "/memory", "/ping", "/screenshot", "/reconnect",
        "/reload", "/profit", "/loss", "/clearlogs",
      ];
      const cmd = msg.text.split(" ")[0];
      if (!known.some((k) => cmd?.startsWith(k))) {
        await send(chatId, `❓ أمر غير معروف: \`${cmd}\`\nاستخدم /start لرؤية الأوامر المتاحة`);
      }
    }
  });

  // Wire up engine events to Telegram notifications
  puppeteerEngine.on("started", async () => {
    await send(chatId, "🚀 *المحرك بدأ!* تم تشغيل نظام التداول بنجاح ✅");
  });

  puppeteerEngine.on("stopped", async () => {
    await send(chatId, "🛑 *المحرك توقف.* Trading engine stopped.");
  });

  puppeteerEngine.on("crashed", async (err) => {
    await send(chatId, `💥 *المحرك تعطل!*\nالخطأ: \`${err}\`\n🔄 جاري إعادة التشغيل التلقائي...`);
  });

  puppeteerEngine.on("restarting", async () => {
    await send(chatId, "🔄 *إعادة تشغيل المحرك...*");
  });

  puppeteerEngine.on("freeze", async () => {
    await send(chatId, "🧊 *تم اكتشاف تجمد!* جاري تحديث الصفحة تلقائياً...");
  });

  wsMonitor.on("statusChange", async (status: string) => {
    if (status === "stale" || status === "disconnected") {
      await send(chatId, `⚠️ *WebSocket ${status}* — جاري إعادة الاتصال...`);
    }
  });

  wsMonitor.on("heartbeat", async () => {
    const stats = wsMonitor.getStats();
    const mem = getMemoryInfo();
    const msg = [
      "💓 *نبضة النظام — System Heartbeat*",
      `⚡ الحالة: \`${stats.status}\``,
      `💾 الذاكرة: \`${mem.used} / ${mem.total}\``,
      `🔄 إعادة الاتصال: \`${stats.totalReconnects}\``,
    ].join("\n");
    await send(chatId, msg);
  });

  return bot;
}

// Send a startup notification to Telegram
export async function sendStartupNotification(): Promise<void> {
  if (!bot) return;
  await send(
    ENV.CHAT_ID,
    [
      "🚀 *تم تشغيل نظام V11 MAGNETAR*",
      "",
      "النظام يعمل الآن بشكل مستقل. استخدم /start للتحكم.",
      `🕐 وقت التشغيل: \`${new Date().toISOString()}\``,
    ].join("\n")
  );
}
