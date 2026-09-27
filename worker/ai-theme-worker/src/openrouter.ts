import { GT_MAX_TOKENS, GtPageType, gtBuildSystemPrompt } from "./prompt.js";

export interface StoreCtx {
  storeName: string;
  description: string;
  whatsapp: string;
  categoriesStr: string;
  categoriesCount: number;
  productsStr: string;
  productsCount: number;
  prompt: string;
}

export interface CallResult {
  ok: boolean;
  html: string;
  status: number;
  body: string;
  timedOut: boolean;
  // "stop" = model finished; "length" = hit max_tokens (page is cut off).
  finishReason: string;
  reasoningTokens: number;
}

// One OpenRouter call, no internal retry loop — retry now lives at the job
// level (ai_theme_jobs.attempt), driven by the queue's own backoff. That
// avoids nesting two retry systems doing the same thing.
export async function callOpenRouter(
  apiKey: string,
  model: string,
  pageType: GtPageType,
  ctx: StoreCtx,
  extraInstruction: string,
  timeoutSeconds: number
): Promise<CallResult> {
  const systemPrompt =
    gtBuildSystemPrompt(
      pageType, ctx.storeName, ctx.description, ctx.whatsapp,
      ctx.categoriesStr, ctx.categoriesCount, ctx.productsStr, ctx.productsCount, ctx.prompt
    ) + extraInstruction;

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), timeoutSeconds * 1000);

  let resp: Response;
  try {
    resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://yesgive.shop",
        "X-Title": "Vendy Theme Generator",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate the ${pageType} page. Design brief: ${ctx.prompt}` },
        ],
        max_tokens: GT_MAX_TOKENS[pageType],
        temperature: 0.7,
        stream: false,
        // See supabase/functions/ai-designer/index.ts for why: Kimi K2.5
        // defaults to "thinking" mode (50-120s/page); instant mode skips
        // that and writes HTML directly, same model/quality, far faster.
        thinking: { type: "disabled" },
        // OpenRouter ignores Moonshot's native `thinking` field above — this
        // is OpenRouter's own switch. K2.5 reasons by default, and reasoning
        // tokens share the max_tokens budget with the HTML, which was cutting
        // pages off mid-<style> before any markup was written.
        reasoning: { enabled: false },
      }),
      signal: abort.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    const timedOut = err?.name === "AbortError";
    return { ok: false, html: "", status: 0, body: timedOut ? "timeout" : String(err?.message || err), timedOut, finishReason: "", reasoningTokens: 0 };
  }
  clearTimeout(timeout);

  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => "");
    return { ok: false, html: "", status: resp.status, body: bodyText.slice(0, 300), timedOut: false, finishReason: "", reasoningTokens: 0 };
  }

  const json: any = await resp.json();
  let html: string = (json.choices?.[0]?.message?.content || "").trim();
  if (!html.toLowerCase().startsWith("<!doctype") && !html.toLowerCase().startsWith("<html")) {
    const fenced = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (fenced) html = fenced[1].trim();
  }
  const finishReason: string = json.choices?.[0]?.finish_reason || "";
  const reasoningTokens: number = json.usage?.completion_tokens_details?.reasoning_tokens || 0;
  return { ok: true, html, status: resp.status, body: "", timedOut: false, finishReason, reasoningTokens };
}

// A complete page ends with </html>. finish_reason "length" means the
// token budget ran out mid-page — never save that as a finished page.
export function isTruncated(result: CallResult): boolean {
  return result.finishReason === "length" || !result.html.toLowerCase().includes("</html>");
}

// 429/5xx/timeout are transient — worth a job-level retry (new attempt,
// fresh lease). Everything else (400, auth, bad model) will fail the exact
// same way again, so don't burn a retry on it.
export function isRetryableCallResult(result: CallResult): boolean {
  if (result.timedOut) return true;
  if (!result.ok) return result.status === 429 || result.status >= 500 || result.status === 0;
  return false;
}
