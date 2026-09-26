import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error("Missing required env var: " + name);
  return value;
}

export const config = {
  supabaseUrl: requireEnv("SUPABASE_URL"),
  serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  concurrency: Number(process.env.AI_WORKER_CONCURRENCY ?? 6),
  pollIntervalMs: Number(process.env.AI_WORKER_POLL_INTERVAL_MS ?? 1500),
  leaseSeconds: Number(process.env.AI_WORKER_LEASE_SECONDS ?? 240),
  callTimeoutSeconds: Number(process.env.AI_WORKER_CALL_TIMEOUT_SECONDS ?? 180),
  workerName:
    process.env.AI_WORKER_NAME ?? ("worker-" + process.pid + "@" + (process.env.HOSTNAME ?? "vps")),
};
