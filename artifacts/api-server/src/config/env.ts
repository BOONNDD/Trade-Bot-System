import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env file from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

export const ENV = {
  // Telegram Bot Configuration
  TELEGRAM_TOKEN: process.env["TELEGRAM_TOKEN"] ?? "7000681912:AAG8hDi_smn99DYR6aa_THxWmG4ohu-7BX0",
  CHAT_ID: process.env["CHAT_ID"] ?? "7069636058",

  // Target trading platform URL
  TARGET_URL: process.env["TARGET_URL"] ?? "https://pocketoption.com/en/cabinet/demo-quick-high-low/",

  // Puppeteer settings
  HEADLESS: process.env["HEADLESS"] !== "false",
  SESSION_PATH: process.env["SESSION_PATH"] ?? "./session",

  // Reconnect strategy
  RECONNECT_DELAY: Number(process.env["RECONNECT_DELAY"] ?? "5000"),
  MAX_RECONNECT_ATTEMPTS: Number(process.env["MAX_RECONNECT_ATTEMPTS"] ?? "10"),
  STALE_DATA_TIMEOUT_MS: Number(process.env["STALE_DATA_TIMEOUT_MS"] ?? "30000"),

  // Logging
  LOG_DIR: process.env["LOG_DIR"] ?? "./logs",
  LOG_MAX_FILES: Number(process.env["LOG_MAX_FILES"] ?? "10"),
  LOG_MAX_SIZE_MB: Number(process.env["LOG_MAX_SIZE_MB"] ?? "10"),

  // Heartbeat interval (ms)
  HEARTBEAT_INTERVAL_MS: Number(process.env["HEARTBEAT_INTERVAL_MS"] ?? "300000"),

  // Server port
  PORT: Number(process.env["PORT"] ?? "5000"),
};

// Validate required environment variables
export function validateEnv(): void {
  const required = ["TELEGRAM_TOKEN", "CHAT_ID"] as const;
  const missing = required.filter((key) => !ENV[key]);

  if (missing.length > 0) {
    console.warn(
      `[CONFIG] ⚠️ Missing environment variables: ${missing.join(", ")}. Telegram bot will not start.`
    );
  }
}
