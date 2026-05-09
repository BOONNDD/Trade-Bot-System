import os from "node:os";
import { logger } from "../lib/logger.js";

// Format uptime into human-readable string
export function formatUptime(startTime: Date): string {
  const ms = Date.now() - startTime.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Get system memory usage information
export function getMemoryInfo(): {
  used: string;
  total: string;
  percent: string;
  heapUsed: string;
  heapTotal: string;
} {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

  const heapStats = process.memoryUsage();

  return {
    used: formatBytes(usedMem),
    total: formatBytes(totalMem),
    percent: `${memUsagePercent}%`,
    heapUsed: formatBytes(heapStats.heapUsed),
    heapTotal: formatBytes(heapStats.heapTotal),
  };
}

// Get CPU usage
export function getCpuInfo(): string {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });

  const usage = (100 - (100 * totalIdle) / totalTick).toFixed(1);
  return `${usage}%`;
}

// Format bytes to human-readable string
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Exponential backoff delay calculation
export function getBackoffDelay(
  attempt: number,
  baseDelay: number = 5000,
  maxDelay: number = 60000
): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = Math.random() * 1000;
  return Math.floor(delay + jitter);
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Format timestamp for logs
export function timestamp(): string {
  return new Date().toISOString();
}

// Safe async wrapper with logging
export async function safeAsync<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    logger.error({ err, context }, `[SAFE] Error in ${context}`);
    return null;
  }
}
