// PM2 process manager configuration for autonomous 24/7 operation
module.exports = {
  apps: [
    {
      name: "magnetar-trading",
      script: "./dist/index.mjs",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 5000,
      max_restarts: 20,
      min_uptime: "10s",

      // Environment variables for production
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },

      // Log configuration for PM2
      output: "./logs/runtime/pm2-out.log",
      error: "./logs/runtime/pm2-error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Kill timeout before force-kill
      kill_timeout: 10000,
      listen_timeout: 30000,

      // Cron auto-restart at 4:00 AM daily (prevents memory leaks)
      cron_restart: "0 4 * * *",
    },
  ],
};
