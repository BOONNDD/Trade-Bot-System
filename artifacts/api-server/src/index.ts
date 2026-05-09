import app from "./app.js";
import { logger } from "./lib/logger.js";
import { ENV, validateEnv } from "./config/env.js";
import { initLogManager, writeLog } from "./logs/logManager.js";
import { initTelegramBot, sendStartupNotification } from "./bot/telegramBot.js";
import { puppeteerEngine } from "./core/puppeteerEngine.js";

// Validate environment configuration
validateEnv();

// Initialize logging system
initLogManager();

const port = ENV.PORT;

// Start the Express HTTP server
app.listen(port, async () => {
  logger.info({ port }, "Server listening");
  writeLog("runtime", `🚀 HTTP Server started on port ${port}`);

  // Initialize Telegram bot
  const bot = initTelegramBot();

  if (bot) {
    logger.info("[MAIN] Telegram bot initialized");

    // Auto-start the trading engine if credentials are configured
    if (ENV.TARGET_URL) {
      logger.info("[MAIN] Auto-starting Puppeteer trading engine...");
      writeLog("runtime", "⚙️ Auto-starting Puppeteer engine...");

      // Start in background — don't block server startup
      puppeteerEngine.start().then(async () => {
        await sendStartupNotification();
      }).catch((err) => {
        logger.error({ err }, "[MAIN] Engine auto-start failed");
        writeLog("errors", `❌ Auto-start failed: ${err}`);
      });
    }
  } else {
    logger.warn("[MAIN] Telegram bot not initialized — check TELEGRAM_TOKEN and CHAT_ID");
  }
});

// Graceful shutdown handlers
process.on("SIGTERM", async () => {
  logger.info("[MAIN] SIGTERM received — shutting down gracefully");
  writeLog("runtime", "🛑 SIGTERM received — graceful shutdown");
  await puppeteerEngine.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("[MAIN] SIGINT received — shutting down gracefully");
  writeLog("runtime", "🛑 SIGINT received — graceful shutdown");
  await puppeteerEngine.stop();
  process.exit(0);
});

// Catch unhandled errors to prevent crashes
process.on("uncaughtException", (err) => {
  logger.error({ err }, "[MAIN] Uncaught exception");
  writeLog("errors", `💥 Uncaught exception: ${err.message}`);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "[MAIN] Unhandled rejection");
  writeLog("errors", `💥 Unhandled rejection: ${reason}`);
});
