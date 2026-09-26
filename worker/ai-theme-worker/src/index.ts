import { requestDrain, runLoop } from "./worker.js";

// Graceful shutdown: stop claiming new jobs, let in-flight ones finish (they
// hold real leases, so a hard kill isn't catastrophic either — the reaper
// requeues them within a minute — but draining avoids wasting that work).
function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, draining...`);
  requestDrain();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[worker] unhandled rejection:", reason);
});

runLoop().catch((err) => {
  console.error("[worker] fatal error, exiting:", err);
  process.exit(1);
});
