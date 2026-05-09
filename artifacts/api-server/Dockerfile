# Multi-stage Docker build for the MAGNETAR Trading Automation System
FROM node:20-slim AS base

# Install system dependencies required by Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-dejavu-core \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    wget \
    ca-certificates \
    --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# ── Builder Stage ───────────────────────────────────────────────────────────
FROM base AS builder

WORKDIR /app

# Copy package files first for caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/ ./lib/

# Install pnpm
RUN npm install -g pnpm@10

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @workspace/api-server...

# Copy source files
COPY artifacts/api-server/ ./artifacts/api-server/

# Build the project
WORKDIR /app/artifacts/api-server
RUN node ./build.mjs

# ── Production Stage ─────────────────────────────────────────────────────────
FROM base AS production

WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY --from=builder /app/artifacts/api-server/src/core/candle_V11_MAGNETAR.js ./src/core/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/artifacts/api-server/package.json ./

# Create required directories
RUN mkdir -p logs session

# Expose the application port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:5000/api/healthz || exit 1

# Run the application
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
