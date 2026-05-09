# 🧲 V11 MAGNETAR — Trading Automation System

نظام تداول آلي مستقل يعمل 24/7 مع تحكم كامل عبر بوت تليغرام.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `TELEGRAM_TOKEN`, `CHAT_ID`, `TARGET_URL` — see `.env.example`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Automation: Puppeteer (headless Chromium)
- Bot: node-telegram-bot-api
- Logging: file-based with rotation
- Build: esbuild (CJS bundle)
- Process manager: PM2 (ecosystem.config.cjs)
- Deployment: Railway / Docker

## Where things live

- `artifacts/api-server/src/bot/telegramBot.ts` — Telegram bot + all commands
- `artifacts/api-server/src/core/puppeteerEngine.ts` — Puppeteer automation engine
- `artifacts/api-server/src/core/wsMonitor.ts` — WebSocket self-healing monitor
- `artifacts/api-server/src/core/candle_V11_MAGNETAR.js` — Original trading UserScript
- `artifacts/api-server/src/logs/logManager.ts` — Log management (5 categories)
- `artifacts/api-server/src/config/env.ts` — Environment config
- `artifacts/api-server/src/routes/status.ts` — Status API endpoint
- `artifacts/api-server/ecosystem.config.cjs` — PM2 config
- `artifacts/api-server/Dockerfile` — Docker image
- `artifacts/api-server/railway.toml` — Railway deployment config
- `.env.example` — Environment variables template
- `artifacts/api-server/SETUP_ARABIC.md` — Full Arabic setup guide

## Architecture decisions

- Puppeteer externalised in esbuild (already in external list) — loaded at runtime
- UserScript metadata headers stripped before injection via `page.evaluate()`
- WebSocket monitor uses CDP (Chrome DevTools Protocol) to intercept WS frames
- Exponential backoff: `min(base * 2^attempt, maxDelay) + jitter`
- Log categories: trades, websocket, errors, runtime, reconnects — each in its own subdirectory
- Telegram bot disabled gracefully when TOKEN/CHAT_ID not set (no crash)

## Product

- Autonomous trading bot running V11_MAGNETAR on PocketOption
- Full Telegram control: start/stop/restart/screenshot/export/logs
- Real-time WebSocket health monitoring with auto-reconnect
- Rotating log files with remote export via Telegram /export command
- Heartbeat notifications every 5 minutes

## User preferences

- Arabic explanations in documentation
- Code comments in English

## Gotchas

- Must log into PocketOption manually once to populate `./session` cookies before headless works
- Puppeteer is externalized in esbuild build — must be in node_modules at runtime
- Set HEADLESS=false for local debugging/login session setup
- PM2 ecosystem config is `.cjs` (CommonJS) — keep it that way
- Run `pnpm approve-builds` if Puppeteer Chromium download is skipped
