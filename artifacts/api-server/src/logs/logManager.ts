import fs from "node:fs";
import path from "node:path";
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { timestamp } from "../utils/helpers.js";
import { ENV } from "../config/env.js";

// Log categories
export type LogCategory = "trades" | "websocket" | "errors" | "runtime" | "reconnects";

const LOG_CATEGORIES: LogCategory[] = ["trades", "websocket", "errors", "runtime", "reconnects"];

// Ensure log directory exists
function ensureLogDir(): void {
  if (!existsSync(ENV.LOG_DIR)) {
    mkdirSync(ENV.LOG_DIR, { recursive: true });
  }
  LOG_CATEGORIES.forEach((cat) => {
    const dir = path.join(ENV.LOG_DIR, cat);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  });
}

// Get current log file path for a category
function getLogFilePath(category: LogCategory): string {
  const date = new Date().toISOString().split("T")[0];
  return path.join(ENV.LOG_DIR, category, `${category}_${date}.txt`);
}

// Write a log entry to file
export function writeLog(category: LogCategory, message: string): void {
  try {
    ensureLogDir();
    const filePath = getLogFilePath(category);
    const entry = `[${timestamp()}] ${message}\n`;
    fs.appendFileSync(filePath, entry, "utf8");

    // Rotate logs if file too large (max 10MB)
    const stats = statSync(filePath);
    if (stats.size > ENV.LOG_MAX_SIZE_MB * 1024 * 1024) {
      rotateLog(category, filePath);
    }
  } catch {
    // Silently fail — don't crash the app because of a log error
  }
}

// Rotate old log file by renaming it
function rotateLog(category: LogCategory, filePath: string): void {
  const ts = Date.now();
  const rotated = filePath.replace(".txt", `_${ts}.txt`);
  fs.renameSync(filePath, rotated);
  cleanOldLogs(category);
}

// Keep only the last N log files per category
function cleanOldLogs(category: LogCategory): void {
  const dir = path.join(ENV.LOG_DIR, category);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => ({ name: f, time: statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  // Remove old files beyond limit
  files.slice(ENV.LOG_MAX_FILES).forEach((f) => {
    unlinkSync(path.join(dir, f.name));
  });
}

// Read latest N lines from a log category
export function readLatestLogs(category: LogCategory, lines: number = 100): string {
  try {
    const filePath = getLogFilePath(category);
    if (!existsSync(filePath)) return `No logs found for: ${category}`;
    const content = fs.readFileSync(filePath, "utf8");
    const allLines = content.trim().split("\n");
    return allLines.slice(-lines).join("\n") || "Empty log file.";
  } catch {
    return `Error reading logs for: ${category}`;
  }
}

// Read all logs merged into one string
export function readAllLogs(maxLines: number = 500): string {
  const parts: string[] = [];
  LOG_CATEGORIES.forEach((cat) => {
    parts.push(`\n===== ${cat.toUpperCase()} =====\n`);
    parts.push(readLatestLogs(cat, Math.floor(maxLines / LOG_CATEGORIES.length)));
  });
  return parts.join("\n");
}

// Get path to merged log file for Telegram export
export async function exportLogsToFile(): Promise<string> {
  ensureLogDir();
  const exportPath = path.join(ENV.LOG_DIR, `export_${Date.now()}.txt`);
  const content = readAllLogs(1000);
  fs.writeFileSync(exportPath, content, "utf8");
  return exportPath;
}

// Clear all logs
export function clearAllLogs(): void {
  LOG_CATEGORIES.forEach((cat) => {
    const dir = path.join(ENV.LOG_DIR, cat);
    if (existsSync(dir)) {
      readdirSync(dir).forEach((f) => {
        unlinkSync(path.join(dir, f));
      });
    }
  });
}

// Get log stats
export function getLogStats(): Record<LogCategory, { files: number; size: string }> {
  const stats = {} as Record<LogCategory, { files: number; size: string }>;
  LOG_CATEGORIES.forEach((cat) => {
    const dir = path.join(ENV.LOG_DIR, cat);
    if (!existsSync(dir)) {
      stats[cat] = { files: 0, size: "0 B" };
      return;
    }
    const files = readdirSync(dir).filter((f) => f.endsWith(".txt"));
    const totalSize = files.reduce((acc, f) => {
      try { return acc + statSync(path.join(dir, f)).size; } catch { return acc; }
    }, 0);
    const sizeStr = totalSize < 1024 * 1024
      ? `${(totalSize / 1024).toFixed(1)} KB`
      : `${(totalSize / 1024 / 1024).toFixed(2)} MB`;
    stats[cat] = { files: files.length, size: sizeStr };
  });
  return stats;
}

// Initialize log system
export function initLogManager(): void {
  ensureLogDir();
  writeLog("runtime", "🚀 Log Manager initialized");
}
