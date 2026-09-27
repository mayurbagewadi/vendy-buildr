import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import {
  AiThemeJob, claimNextJob, completeJob, deductOneToken, extendLease, failJob,
  loadOpenRouterSettings, loadStoreContext, logHistory, saveHomePage, saveOtherPage,
} from "./db.js";
import { callOpenRouter, isRetryableCallResult, isTruncated, StoreCtx } from "./openrouter.js";
import { gtValidateHTML } from "./prompt.js";

let draining = false;
let inFlight = 0;
const activeJobIds = new Set<string>();

export function requestDrain() {
  draining = true;
}

export function isDraining() {
  return draining;
}

export function activeJobCount() {
  return inFlight;
}

// Main poll loop — bounded concurrency via a simple in-flight counter.
// One idle poll every pollIntervalMs when there's spare capacity and no job
// was available; claimed jobs run without blocking the loop from claiming
// the next one, up to config.concurrency at a time.
export async function runLoop() {
  console.log(`[worker] ${config.workerName} starting, concurrency=${config.concurrency}`);
  while (!draining) {
    if (inFlight >= config.concurrency) {
      await sleep(250);
      continue;
    }
    const job = await claimNextJob();
    if (!job) {
      await sleep(config.pollIntervalMs);
      continue;
    }
    inFlight++;
    activeJobIds.add(job.id);
    processJob(job as AiThemeJob)
      .catch((err) => console.error(`[worker] job ${job.id} threw unexpectedly:`, err))
      .finally(() => {
        inFlight--;
        activeJobIds.delete(job.id);
      });
  }
  console.log(`[worker] draining — waiting on ${inFlight} in-flight job(s)`);
  while (inFlight > 0) await sleep(500);
  console.log("[worker] drained, exiting");
}

async function processJob(job: AiThemeJob): Promise<void> {
  const label = `${job.page_type} (${job.id.slice(0, 8)}, attempt ${job.attempt})`;
  console.log(`[worker] claimed ${label}`);

  const settings = await loadOpenRouterSettings();
  if (!settings) {
    await failJob(job.id, job.attempt, "AI not configured (missing OpenRouter key/model)", false);
    return;
  }

  const storeCtx = await loadStoreContext(job.store_id);
  if (!storeCtx) {
    await failJob(job.id, job.attempt, "Store not found", false);
    return;
  }
  const ctx: StoreCtx = { ...storeCtx, prompt: job.prompt };

  // Cancellation can be requested any time before we start the expensive call.
  const preCheck = await extendLease(job.id, job.attempt);
  if (!preCheck.stillOwned) {
    console.warn(`[worker] lost lease before starting ${label} (reclaimed by another worker)`);
    return;
  }
  if (preCheck.cancelRequested) {
    await failJob(job.id, job.attempt, "Cancelled by user", false);
    return;
  }

  const first = await callOpenRouter(settings.apiKey, settings.model, job.page_type, ctx, "", config.callTimeoutSeconds);

  if (!first.ok) {
    const retryable = isRetryableCallResult(first);
    console.warn(`[worker] ${label} call failed: ${first.status} ${first.body} (retryable=${retryable})`);
    await failJob(job.id, job.attempt, `AI service error (${first.status}): ${first.body}`, retryable);
    return;
  }

  let html = first.html;
  let check = gtValidateHTML(job.page_type, html);
  let truncated = isTruncated(first);
  console.log(`[worker] ${label} attempt-call done: finish=${first.finishReason || "?"}, reasoningTokens=${first.reasoningTokens}, ${html.length} chars${truncated ? ", CUT OFF" : ""}`);

  if (!check.valid || truncated) {
    // Heartbeat + cancel-check before spending a second full call on repair.
    const mid = await extendLease(job.id, job.attempt);
    if (!mid.stillOwned) {
      console.warn(`[worker] lost lease before repair retry on ${label}`);
      return;
    }
    if (mid.cancelRequested) {
      await failJob(job.id, job.attempt, "Cancelled by user", false);
      return;
    }

    const retryInstruction = truncated
      ? "\n\nSTRICT: your previous output was cut off before the page was finished. Keep the CSS concise " +
        "and output the COMPLETE page, including every required element id, ending with </html>.\n"
      : `\n\nSTRICT: your previous output was missing these required element ids: ${check.missing.join(", ")}. ` +
        "Include every one of them exactly as specified above.\n";
    const repaired = await callOpenRouter(settings.apiKey, settings.model, job.page_type, ctx, retryInstruction, config.callTimeoutSeconds);
    if (repaired.ok && repaired.html) {
      html = repaired.html;
      check = gtValidateHTML(job.page_type, html);
      truncated = isTruncated(repaired);
      console.log(`[worker] ${label} repair-call done: finish=${repaired.finishReason || "?"}, reasoningTokens=${repaired.reasoningTokens}, ${html.length} chars${truncated ? ", CUT OFF" : ""}`);
    }
    // If the repair call itself fails, fall through with the first (still
    // usable, just missing some ids) result — matches the prior lenient
    // behavior rather than failing a page over a cosmetic gap.
  }

  if (!html) {
    await failJob(job.id, job.attempt, "AI returned empty output", true);
    return;
  }

  // A cut-off page is broken (no markup after the <style> block), unlike a
  // page missing a few ids — never save it; let the queue retry the job.
  if (truncated) {
    await failJob(job.id, job.attempt, "AI output was cut off before the page finished", true);
    return;
  }

  const versionId = randomUUID();
  try {
    if (job.page_type === "home") {
      await saveHomePage(job.store_id, html, job.prompt, versionId);
    } else {
      await saveOtherPage(job.store_id, job.page_type, html);
    }
  } catch (err: any) {
    // Save failed after a successful (expensive) generation — worth a retry
    // rather than throwing away a good result over a transient DB hiccup.
    await failJob(job.id, job.attempt, `Save failed: ${err.message}`, true);
    return;
  }

  // Fence BEFORE charging/logging — if this worker's lease has since been
  // reclaimed (a fresher attempt already owns this job), the HTML we just
  // saved is a harmless duplicate write, but token deduction and history
  // must never double-count. That's the whole point of the fence.
  const owned = await completeJob(job.id, job.attempt, html.length, check.missing, versionId);
  if (!owned) {
    console.warn(`[worker] ${label} generated + saved, but lease was already reclaimed — skipping token charge/history (avoids double charge).`);
    return;
  }

  await deductOneToken(job.store_id);
  await logHistory(job.store_id, job.user_id, job.prompt, job.page_type, html.length, check.missing, versionId);
  console.log(`[worker] completed ${label}: ${html.length} chars${check.missing.length ? `, missing=${check.missing.join(",")}` : ""}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
