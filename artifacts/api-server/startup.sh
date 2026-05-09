#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# Startup Script — V11 MAGNETAR Trading Automation System
# سكريبت تشغيل نظام التداول الآلي V11 MAGNETAR
# ════════════════════════════════════════════════════════════════════════

set -e

echo "🧲 Starting V11 MAGNETAR Trading Automation System..."
echo "════════════════════════════════════════════════════════"

# Check if .env file exists
if [ ! -f "../../.env" ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "   Copy .env.example to .env and fill in your credentials."
    echo "   cp ../../.env.example ../../.env"
    exit 1
fi

# Create required directories
mkdir -p logs/trades logs/websocket logs/errors logs/runtime logs/reconnects session

# Install dependencies if node_modules missing
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

# Build the project
echo "🔨 Building project..."
node ./build.mjs

echo "✅ Build complete!"
echo ""

# Choose startup method
if command -v pm2 &> /dev/null; then
    echo "🚀 Starting with PM2 (recommended for production)..."
    pm2 start ecosystem.config.cjs
    pm2 save
    echo ""
    echo "📊 PM2 Status:"
    pm2 list
    echo ""
    echo "📋 View logs: pm2 logs magnetar-trading"
    echo "🔄 Restart:   pm2 restart magnetar-trading"
    echo "🛑 Stop:      pm2 stop magnetar-trading"
else
    echo "🚀 Starting directly (install PM2 for production use)..."
    echo "   npm install -g pm2"
    echo ""
    node --enable-source-maps ./dist/index.mjs
fi
