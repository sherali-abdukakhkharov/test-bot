/**
 * PM2 Ecosystem Config — Arab Tili Yordamchi Bot
 *
 * Production deploy steps:
 *   1. npm install                          # install / link workspace packages
 *   2. npm run web:build                    # build React panel → apps/bot/public/
 *   3. npm run bot:build                    # compile NestJS → apps/bot/dist/
 *   4. npm run migrate                      # run pending DB migrations
 *   5. pm2 start ecosystem.config.js --env production
 *   6. pm2 save && pm2 startup              # persist across reboots
 *
 * Secrets — set these in apps/bot/.env on the server (never commit the file):
 *   BOT_TOKEN=
 *   DATABASE_URL=
 *   JWT_SECRET=
 *   JWT_EXPIRES_IN=8h
 *   PORT=3737  (overridden by env_production above, but keep in sync)
 *   CORS_ORIGINS=https://yourdomain.com
 */

module.exports = {
  apps: [
    {
      name: 'arab-tili-bot',

      // Entry point — NestJS compiles to apps/bot/dist/apps/bot/src/main.js
      script: 'dist/apps/bot/src/main.js',
      cwd: './apps/bot',

      // Telegram long-polling must run on exactly ONE process
      instances: 1,
      exec_mode: 'fork',

      watch: false,
      max_memory_restart: '512M',

      // Restart policy
      restart_delay: 5000,   // wait 5 s before restarting on crash
      max_restarts: 10,
      min_uptime: '10s',     // crash-loop guard

      // Non-secret production env vars — set here so PM2 always injects them explicitly.
      // Secrets (BOT_TOKEN, DATABASE_URL, JWT_SECRET, etc.) stay in apps/bot/.env
      env_production: {
        NODE_ENV: 'production',
        PORT: 3737,
      },

      // Logs — written relative to cwd (apps/bot/logs/)
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
