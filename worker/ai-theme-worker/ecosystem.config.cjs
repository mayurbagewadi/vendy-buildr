// PM2 process config. On the VPS: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "ai-theme-worker",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1, // scale by raising AI_WORKER_CONCURRENCY first; add a
                    // second PM2 instance only once one process's concurrency
                    // is maxed and the queue is still backing up — the lease
                    // design makes multiple instances safe with zero code
                    // changes (SKIP LOCKED prevents two workers claiming the
                    // same job).
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 20,
      kill_timeout: 15000, // give SIGTERM drain time before PM2 force-kills
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
