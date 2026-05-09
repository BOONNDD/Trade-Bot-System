import { Router } from "express";
import { puppeteerEngine } from "../core/puppeteerEngine.js";
import { wsMonitor } from "../core/wsMonitor.js";
import { getMemoryInfo, formatUptime } from "../utils/helpers.js";
import { getLogStats, readLatestLogs, type LogCategory } from "../logs/logManager.js";

const router = Router();

// GET /api/status — full system status
router.get("/status", (_req, res) => {
  const engineStatus = puppeteerEngine.getStatus();
  const wsStats = wsMonitor.getStats();
  const mem = getMemoryInfo();
  const logStats = getLogStats();
  const trades = puppeteerEngine.getTradeStats();
  const startTime = puppeteerEngine.getStartTime();

  res.json({
    ok: true,
    engine: {
      status: engineStatus,
      startTime,
      uptime: startTime ? formatUptime(startTime) : null,
      trades,
    },
    websocket: {
      status: wsStats.status,
      lastTickAt: wsStats.lastTickAt,
      reconnectAttempts: wsStats.reconnectAttempts,
      totalReconnects: wsStats.totalReconnects,
    },
    memory: mem,
    logs: logStats,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/status/logs/:category — get logs for a specific category
router.get("/status/logs/:category", (req, res) => {
  const { category } = req.params as { category: string };
  const { lines } = req.query as { lines?: string };

  const validCategories: LogCategory[] = ["trades", "websocket", "errors", "runtime", "reconnects"];
  if (!validCategories.includes(category as LogCategory)) {
    res.status(400).json({ ok: false, error: "Invalid log category" });
    return;
  }

  const content = readLatestLogs(category as LogCategory, Number(lines ?? 100));
  res.json({ ok: true, category, content });
});

export default router;
