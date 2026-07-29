// PM2 process definition, for deployments not using Docker.
//
//   pm2 start ecosystem.config.js
//   pm2 startup && pm2 save
//
// Environment comes from .env, which bin/www loads through dotenv — keep
// secrets there rather than here, since this file is committed.

module.exports = {
  apps: [
    {
      name: "hyperbook-cloud",
      script: "./bin/www",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      // SQLite does not support concurrent writes from multiple processes.
      // This is not a number to tune; a second instance corrupts data.
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "256M",
      // Relative to cwd, so no directory has to be created by hand. Point
      // these somewhere else if you collect logs centrally.
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      // A crash loop at boot is usually a config error the server is
      // deliberately refusing to start on. Back off instead of spinning.
      restart_delay: 2000,
      max_restarts: 10,
    },
  ],
};
