# AI Designer — Edge Function Documentation

**File:** `supabase/functions/ai-designer/index.ts`
**Runtime:** Deno (Supabase Edge Functions)
**AI Model:** Configurable via `platform_settings.openrouter_model` (default: `moonshotai/kimi-k2.5`)
**API Provider:** OpenRouter (`https://openrouter.ai/api/v1/chat/completions`)
**Last Updated:** March 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture — Layer 1 vs Layer 2](#2-architecture--layer-1-vs-layer-2)
3. [SSE Streaming + Heartbeat](#3-sse-streaming--heartbeat)
4. [Actions (API Endpoints)](#4-actions-api-endpoints)
5. [Database Tables](#5-database-tables)
6. [Key Functions](#6-key-functions)
7. [Token System](#7-token-system)
8. [Dark / Light Mode Support](#8-dark--light-mode-support)
9. [CSS Merging (Cumulative Design)](#9-css-merging-cumulative-design)
10. [Security — CSS Sanitization](#10-security--css-sanitization)
11. [Configuration](#11-configuration)
12. [Deployment](#12-deployment)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Overview

The AI Designer edge function is the backend brain of the AI-powered store customization system. Store owners describe design changes in plain English, and this function:

1. Receives the request from the frontend
2. Checks token balance (credit system)
3. Builds a context-aware system prompt (HTML structure + existing CSS + theme)
4. Calls the AI model via OpenRouter
5. Streams tokens back to the client in real-time (SSE)
6. Parses the AI output into structured CSS + summary + changes
7. Merges new CSS with existing (cumulative design — never overwrites)
8. Saves to database
9. Sends final result to client

---

## 2. Architecture — Layer 1 vs Layer 2

The system has two design layers that work together:

### Layer 1 — CSS Variables
- **What it does:** Changes CSS custom properties (`--primary`, `--background`, `--radius`, etc.)
- **Action:** `chat` or `generate_design`
- **Output:** JSON object with `css_variables`, `dark_css_variables`, `layout`, `fonts`
- **Storage:** `store_design_state.current_design` (JSON column)
- **Use case:** Color palette changes, font changes, border radius tweaks
- **Applied via:** `buildDesignCSS()` on the client → injects `:root { --primary: ...; }` style tag

### Layer 2 — Full CSS Generation
- **What it does:** Generates complete CSS rules targeting actual HTML elements
- **Action:** `generate_full_css`
- **Output:** Raw CSS string with real selectors (e.g., `[data-ai="header"] { ... }`)
- **Storage:** `store_design_state.ai_full_css` (text column) + `mode: "advanced"`
- **Use case:** Redesigns, layout changes, glassmorphism, custom card styles, section-level changes
- **Applied via:** Injected as `<style id="ai-layer2-styles">` tag directly into the page

### Priority
Layer 2 CSS is injected **after** Layer 1 CSS — it takes visual priority. Both work simultaneously.

### `data-ai` Selectors Available to Layer 2

| Selector | Element |
|---|---|
| `[data-ai="header"]` | Site header / navigation |
| `[data-ai="section-hero"]` | Hero banner section |
| `[data-ai="section-categories"]` | Shop by Category section |
| `[data-ai="category-card"]` | Category card outer wrapper |
| `[data-ai="category-card-inner"]` | Category card shell (border/shadow/bg) |
| `[data-ai="category-card-image-container"]` | Category photo box |
| `[data-ai="category-card-image"]` | Category photo `<img>` |
| `[data-ai="category-card-overlay"]` | Gradient overlay on category photo |
| `[data-ai="category-card-name"]` | Category name `<h3>` |
| `[data-ai="category-card-count"]` | Product count `<p>` |
| `[data-ai="section-featured"]` | Featured products section |
| `[data-ai="product-card"]` | Product card |
| `[data-ai="section-reels"]` | Reels/video section |
| `[data-ai="section-reviews"]` | Reviews section |
| `[data-ai="section-new-arrivals"]` | New arrivals section |
| `[data-ai="section-cta"]` | Call-to-action section |
| `[data-ai="section-footer"]` | Footer |

---

## 3. SSE Streaming + Heartbeat

### The Problem
Kimi K2.5 takes 30–90 seconds to generate full CSS. Cloudflare (free plan) has a **100-second idle timeout** — if no data flows for 100 seconds, it cuts the connection and returns a **524 error**.

### The Solution — SSE with Heartbeat
Server-Sent Events (SSE) is a protocol where the server streams data to the client line by line. Each line sent resets Cloudflare's idle timer.

**Flow:**
```
0s   → Request received → SSE stream opens immediately (HTTP 200)
0s   → ": connected\n\n" sent to client
20s  → ": heartbeat\n\n" sent  ← Cloudflare timer resets to 0
40s  → ": heartbeat\n\n" sent  ← Cloudflare timer resets to 0
60s  → ": heartbeat\n\n" sent  ← Cloudflare timer resets to 0
75s  → AI starts generating → "data: {"chunk": "..."}\n\n" streams per token
85s  → AI finishes → CSS parsed → saved to DB
85s  → "data: {"done": true, "css": "...", ...}\n\n" sent
85s  → Stream closes
```

### SSE Event Types

| Event | Format | Meaning |
|---|---|---|
| Heartbeat comment | `: heartbeat\n\n` | Keep-alive ping — browser ignores, Cloudflare resets timer |
| Connected comment | `: connected\n\n` | Stream opened confirmation |
| Chunk | `data: {"chunk": "..."}\n\n` | AI token — shown progressively in chat bubble |
| Done | `data: {"done": true, "css": "...", ...}\n\n` | Final result with CSS + summary + changes |
| Error | `data: {"error": "..."}\n\n` | Something went wrong (token not deducted) |

### Client-Side Reading (`src/lib/aiDesigner.ts` — `generateFullCSSStream`)
```typescript
// Uses raw fetch() — NOT supabase.functions.invoke() (which buffers full response)
const response = await fetch(EDGE_FUNCTION_URL, { method: "POST", headers: { Authorization: "Bearer " + token }, body: ... });
const reader = response.body.getReader();
// Reads line by line:
// - Lines starting with ":" → skip (heartbeat)
// - Lines starting with "data: " → parse JSON
//   - data.chunk → call onChunk() → text appears in chat progressively
//   - data.done → return final result
//   - data.error → throw error
```

### Why raw `fetch()` and not `supabase.functions.invoke()`?
`supabase.functions.invoke()` waits for the **complete response body** before returning — it cannot read SSE events incrementally. Raw `fetch()` gives access to `response.body` as a `ReadableStream`, which is required for SSE.

### Nginx Config Required
```nginx
proxy_buffering off;       # CRITICAL — passes SSE chunks through without buffering
proxy_read_timeout 180s;   # Must be > Supabase edge function timeout (150s)
proxy_connect_timeout 10s;
proxy_send_timeout 180s;
```

---

## 4. Actions (API Endpoints)

All requests are `POST` to `/functions/v1/ai-designer` with JSON body `{ action: "...", ... }`.

---

### `get_token_balance`
Check remaining AI tokens for a store.

**Request:**
```json
{ "action": "get_token_balance", "store_id": "uuid" }
```
**Response:**
```json
{ "success": true, "tokens_remaining": 42, "expires_at": "2026-04-01T00:00:00Z", "has_tokens": true }
```
**Side effects:** Auto-expires overdue token purchases, deletes expired + old pending purchases.

---

### `chat`
Layer 1 design — CSS variables only. For color/font/radius changes.

**Request:**
```json
{
  "action": "chat",
  "store_id": "uuid",
  "user_id": "uuid",
  "messages": [{ "role": "user", "content": "Make it green and modern" }],
  "theme": "light"
}
```
**Response:**
```json
{
  "success": true,
  "design": {
    "summary": "Changed primary color to green...",
    "css_variables": { "primary": "142 71% 45%", "radius": "0.75rem" },
    "dark_css_variables": { "primary": "142 60% 55%" },
    "layout": { "product_grid_cols": "4" },
    "fonts": { "heading": "Playfair Display", "body": "Inter" },
    "changes_list": ["Primary color → changed to green", "Border radius → increased"]
  },
  "tokens_remaining": 41
}
```
**Retry logic:** Up to 3 attempts with enhanced prompts on failure. Temperature drops from 0.1 → 0.05 on retries.

---

### `generate_design`
Alias for `chat` with a single message. Same behavior and response.

**Request:**
```json
{ "action": "generate_design", "store_id": "uuid", "user_id": "uuid", "prompt": "Make it luxury dark" }
```

---

### `generate_full_css` ← Main Layer 2 Action
Full CSS generation. Returns SSE stream. Requires `html_structure` of the store page.

**Request:**
```json
{
  "action": "generate_full_css",
  "store_id": "uuid",
  "user_id": "uuid",
  "html_structure": "<section data-ai='header'>...</section>...",
  "layer1_baseline": null,
  "messages": [
    { "role": "user", "content": "previous prompt" },
    { "role": "assistant", "content": "[Applied CSS — 12 rules]" },
    { "role": "user", "content": "make buttons rounded and cards have shadows" }
  ],
  "theme": "light"
}
```

**SSE Response stream** (see Section 3 for full SSE format):
```
: connected

: heartbeat

data: {"chunk": "[data-ai="}
data: {"chunk": "\"header\"] {"}
data: {"chunk": " background: #fff; }"}
...
data: {
  "done": true,
  "css": "[data-ai=\"header\"] { ... } .dark [data-ai=\"header\"] { ... }",
  "changes_list": ["Header → Solid white background with subtle shadow", "Buttons → Rounded pill shape with hover glow"],
  "tokens_remaining": 40,
  "message": "I gave your header a clean white background and rounded your buttons..."
}
```

**What it does internally:**
1. Validates store_id, user_id, html_structure, messages
2. Checks token balance → 402 if no tokens
3. Reads existing `ai_full_css` from DB (for merge context)
4. Builds `buildLayer2SystemPrompt()` with HTML + existing CSS + theme
5. Opens SSE stream immediately
6. Starts heartbeat interval (every 20s)
7. Calls OpenRouter with `stream: true`
8. Forwards AI tokens as `{ chunk: "..." }` SSE events
9. After AI finishes: parses CSS + SUMMARY + CHANGES from full output
10. Sanitizes CSS (removes XSS patterns)
11. Merges with existing CSS (`mergeCSS()`)
12. Deducts 1 token
13. Saves merged CSS to `store_design_state`
14. Logs to `ai_designer_history`
15. Sends `{ done: true, css, changes_list, tokens_remaining, message }` event
16. Closes stream

---

### `apply_design`
Publish Layer 1 design to live store (saves to `current_design` column).

**Request:**
```json
{
  "action": "apply_design",
  "store_id": "uuid",
  "design": { "css_variables": { "primary": "142 71% 45%" }, ... },
  "history_id": "uuid"
}
```
**Response:**
```json
{ "success": true }
```
**Note:** Layer 2 CSS is saved automatically during `generate_full_css`. The Publish button for Layer 2 is a UI confirmation only — CSS is already live in DB.

---

### `reset_design`
Delete all AI design for a store (both Layer 1 and Layer 2). Store reverts to platform default.

**Request:**
```json
{ "action": "reset_design", "store_id": "uuid" }
```
**Response:**
```json
{ "success": true, "message": "Store design reset to platform default" }
```
**Note:** Deletes the entire `store_design_state` row for the store.

---

### `create_payment_order`
Create Razorpay payment order for token purchase.

**Request:**
```json
{
  "action": "create_payment_order",
  "store_id": "uuid",
  "user_id": "uuid",
  "package_id": "uuid",
  "amount": 99900,
  "currency": "INR"
}
```
**Response:**
```json
{ "success": true, "order_id": "order_xxx", "amount": 99900, "currency": "INR", "key_id": "rzp_xxx" }
```

---

## 5. Database Tables

### `store_design_state`
Stores the active design for each store.

| Column | Type | Description |
|---|---|---|
| `store_id` | UUID | Primary key (one row per store) |
| `current_design` | JSONB | Layer 1 design JSON (css_variables, layout, fonts) |
| `ai_full_css` | TEXT | Layer 2 full CSS string (merged cumulative) |
| `layer1_snapshot` | JSONB | Layer 1 state at time of last Layer 2 generation |
| `mode` | TEXT | `"simple"` (Layer 1 only) or `"advanced"` (Layer 2 active) |
| `last_applied_at` | TIMESTAMP | When Layer 1 was last published |
| `ai_full_css_applied_at` | TIMESTAMP | When Layer 2 CSS was last updated |
| `updated_at` | TIMESTAMP | Last update timestamp |

**How the customer store reads it:**
```typescript
// Layer 2 (priority):
if (data.mode === "advanced" && data.ai_full_css) → inject as <style id="ai-layer2-styles">
// Layer 1 (base):
if (data.current_design) → buildDesignCSS(design) → inject as <style id="ai-designer-styles">
```

### `ai_token_purchases`
Each row = one token package purchase by a store.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `store_id` | UUID | Which store |
| `tokens_remaining` | INT | Current balance |
| `tokens_used` | INT | Total used from this purchase |
| `status` | TEXT | `"active"`, `"expired"`, `"pending"` |
| `expires_at` | TIMESTAMP | When tokens expire (null = never) |

**Token deduction:** `tokens_remaining - 1`, `tokens_used + 1` on every successful generation.

### `ai_token_packages`
Available packages shown on the Buy Tokens page (managed by super admin).

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | TEXT | Package name (e.g., "Basic", "Pro") |
| `tokens` | INT | Number of tokens |
| `price` | INT | Price in paise (INR) |
| `is_active` | BOOLEAN | Show/hide package |

### `ai_token_settings`
Singleton row for global token settings.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Always `00000000-0000-0000-0000-000000000001` |
| `expiry_days` | INT | How many days after purchase tokens expire |

### `ai_designer_history`
Log of every AI generation.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `store_id` | UUID | Which store |
| `user_id` | UUID | Which user |
| `prompt` | TEXT | User's original prompt |
| `ai_response` | JSONB | Full AI response data (css, mode, changes_list) |
| `tokens_used` | INT | Always 1 |
| `applied` | BOOLEAN | Whether this was published to live store |
| `created_at` | TIMESTAMP | When generated |

### `platform_settings`
Singleton row for platform configuration.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Always `00000000-0000-0000-0000-000000000000` |
| `openrouter_api_key` | TEXT | OpenRouter API key (never exposed to client) |
| `openrouter_model` | TEXT | AI model ID (e.g., `moonshotai/kimi-k2.5`) |

---

## 6. Key Functions

### `buildLayer2SystemPrompt(htmlStructure, layer1Baseline, existingCSS, theme)`
Builds the system prompt for Layer 2 CSS generation.

- **`htmlStructure`** — Structural skeleton of the store page (extracted by `extractSkeleton()` on client). Contains `data-ai` attributes, tag names, text snippets. ~3000-6000 chars.
- **`existingCSS`** — Current `ai_full_css` from DB. AI uses this to avoid overwriting unchanged sections.
- **`theme`** — `"light"` or `"dark"`. Tells AI which mode the admin is currently viewing.

**Dark mode instructions included in prompt:**
- AI must generate both light base styles AND `.dark` prefixed overrides
- Example: `[data-ai="header"] { background: #fff; }` + `.dark [data-ai="header"] { background: #0f172a; }`

### `mergeCSS(existing, incoming)`
Merges new AI-generated CSS with existing stored CSS without losing previous changes.

```
Algorithm:
1. Parse all selectors from incoming CSS
2. Remove those same selectors from existing CSS (they're being updated)
3. Combine: filtered-existing + "/* --- AI Update --- */" + incoming
```

This ensures:
- "Make buttons green" → button CSS updated
- "Make header dark" → header CSS added, button CSS preserved

### `sanitizeCSS(css)`
Removes dangerous patterns before storing/applying CSS.

Blocked patterns: `javascript:`, `expression()`, `@import`, `<script`, `behavior:`, `binding:`, `-moz-binding`, `vbscript:`

### `classifyUserIntent(userPrompt)`
Classifies user intent as `"targeted"` or `"complete"`. Used for logging only — the AI decides its own scope.

- `"targeted"` → Small change ("make buttons rounded")
- `"complete"` → Full redesign ("redesign everything", "luxury dark theme")

### `buildSystemPrompt(storeName, currentDesign, theme, storeType)`
Builds the Layer 1 system prompt (for `chat` action). Includes current design state, store context, and design system capabilities.

### `buildDesignSystemContext(currentDesign, storeType)`
Extracts available colors, component capabilities, current design state, and constraints for the AI. Used to prevent AI from suggesting impossible changes.

---

## 7. Token System

**Flow:**
```
Super Admin sets packages → Store owner buys via Razorpay → tokens stored in ai_token_purchases
→ Each generate_full_css call → deducts 1 token → balance shown in UI
```

**Balance check on every request:**
1. Auto-expire purchases where `expires_at < now`
2. Delete expired purchases
3. Sum `tokens_remaining` across all active purchases
4. If 0 → return 402 error (no token deducted)

**Token deduction:** Only happens AFTER successful CSS generation and DB save. If AI returns empty CSS or errors, no token is deducted.

**Expiry:** Controlled by `ai_token_settings.expiry_days`. Super admin sets this globally.

---

## 8. Dark / Light Mode Support

The app uses `next-themes` which adds `class="dark"` to `<html>` for dark mode.

**How AI handles it:**

The `theme` parameter tells the AI which mode is currently active. The AI is instructed to **always generate both variants**:

```css
/* Light mode — base styles */
[data-ai="header"] { background: #ffffff; color: #111111; }

/* Dark mode — activated when <html class="dark"> */
.dark [data-ai="header"] { background: #0f172a; color: #e2e8f0; }
```

**Client passes theme:** `resolvedTheme === "dark" ? "dark" : "light"` from `useTheme()` hook.

**Customer store applies it:** Both `ai-layer2-styles` CSS is injected — dark variants activate automatically when user toggles dark mode.

---

## 9. CSS Merging (Cumulative Design)

**Problem it solves:** Without merging, each AI request would overwrite the previous design. "Make buttons green" followed by "make header dark" would lose the green buttons.

**`mergeCSS()` algorithm:**
```
Turn 1: User says "make buttons green"
  → AI generates: [data-ai="product-card"] .button { background: green; }
  → existingCSS: ""
  → mergedCSS: "...green button CSS..."
  → Saved to DB

Turn 2: User says "make header dark"
  → AI generates: [data-ai="header"] { background: #0f172a; }
  → existingCSS: "...green button CSS..." (read from DB)
  → mergeCSS removes [data-ai="header"] from existing (none found)
  → mergedCSS: "...green button CSS... /* --- AI Update --- */ ...header dark CSS..."
  → Saved to DB — BOTH changes preserved
```

**Client also tracks cumulative CSS** in `cumulativeCSSRef` — injected into preview iframe on every update.

**On page refresh** — `savedLayer2CSSRef` is loaded from DB on mount, re-injected when iframe loads.

---

## 10. Security — CSS Sanitization

Every piece of CSS generated by the AI goes through `sanitizeCSS()` before being stored or applied.

**Blocked patterns:**

| Pattern | Why blocked |
|---|---|
| `javascript:` | XSS via CSS url() values |
| `expression()` | IE-era CSS execution |
| `@import` | Could import malicious external CSS |
| `<script` | HTML injection attempt |
| `behavior:` | IE-era CSS execution |
| `binding:` | Firefox-era CSS execution |
| `-moz-binding` | Firefox-era CSS execution |
| `vbscript:` | XSS via VBScript |

If CSS fails sanitization → `finalCSS = ""` → 422 error returned → **no token deducted**.

---

## 11. Configuration

### AI Model
Set via Super Admin → Platform Settings → "AI Designer — OpenRouter API" card.
- Stored in `platform_settings.openrouter_model`
- Read fresh on every request (no redeploy needed when changed)
- Default fallback: `moonshotai/kimi-k2-thinking` (if DB value is empty)
- Recommended: `moonshotai/kimi-k2.5` (supports vision + text, 262K context)

### OpenRouter API Key
- Stored in `platform_settings.openrouter_api_key`
- **Never exposed to client** — only read server-side in edge function
- Set via Super Admin panel

### Hardcoded Constants

| Constant | Value | Purpose |
|---|---|---|
| `SETTINGS_ID` | `00000000-0000-0000-0000-000000000000` | `platform_settings` row ID |
| Token settings ID | `00000000-0000-0000-0000-000000000001` | `ai_token_settings` row ID |
| Heartbeat interval | `20000ms` (20s) | Keep-alive ping frequency |
| Max tokens | `4000` | Max AI output tokens per request |
| Temperature | `0.2` | AI creativity (lower = more consistent CSS) |
| Messages history | Last 8 messages | Sent to AI for context |

---

## 12. Deployment

### Deploy edge function
```bash
npx supabase functions deploy ai-designer
```

### Required environment variables (auto-injected by Supabase)
```
SUPABASE_URL              → Supabase project URL
SUPABASE_SERVICE_ROLE_KEY → Full DB access (never exposed to client)
```

### Database migrations
```bash
# Apply Layer 2 CSS system migration
npx supabase db push
# Or manually run:
supabase/migrations/20260224000000_add_layer2_css_system.sql
```

### Nginx config (required on proxy server)
```nginx
# /etc/nginx/sites-enabled/api.digitaldukandar.in
location / {
    proxy_pass https://vexeuxsvckpfvuxqchqu.supabase.co;
    proxy_set_header Host vexeuxsvckpfvuxqchqu.supabase.co;
    proxy_ssl_server_name on;
    proxy_ssl_protocols TLSv1.2 TLSv1.3;
    proxy_read_timeout 180s;    # Must exceed Supabase 150s limit
    proxy_connect_timeout 10s;
    proxy_send_timeout 180s;
    proxy_buffering off;        # CRITICAL for SSE streaming
}
```

---

## 13. Troubleshooting

### 524 Cloudflare Timeout
**Cause:** AI takes >100s and Cloudflare cuts the connection.
**Fix:** SSE heartbeat is already implemented. Verify nginx has `proxy_buffering off`.
**Verify:** Check nginx config with `grep proxy_buffering /etc/nginx/sites-enabled/api.digitaldukandar.in`

### CORS Error from localhost
**Cause:** `api.digitaldukandar.in` blocks requests from `localhost:8080` (different origin).
**Note:** This only happens in local development. In production (deployed site) it works correctly.
**Workaround:** Test on deployed production URL, or use Supabase CLI to run functions locally.

### "AI did not generate any CSS" (422 error)
**Cause:** AI returned empty output or all CSS was blocked by sanitization.
**No token deducted.**
**Fix:** Try a more specific prompt. Check Supabase edge function logs for the AI's actual output.

### Empty HTML Snapshot (Layer 2 falls back to Layer 1)
**Cause:** `captureCleanHTMLSnapshot()` couldn't find `[data-ai]` elements — React hadn't hydrated yet.
**Fix:** Snapshot capture retries at [500, 1500, 3000, 5000, 8000ms]. If still failing, check the iframe URL is loading correctly.
**Debug:** Console log `[HTML-SNAPSHOT]` shows attempt count and element count.

### Design vanishes after page refresh
**Cause:** `ai_full_css` not being loaded from DB on mount.
**Fix:** `getLayer2CSS()` is called in `loadInitialData()`. Check `[LAYER2-RESTORE]` in console.

### Token not deducting
**Cause:** AI returned empty CSS or an error occurred before the deduction step.
**This is correct behavior** — tokens are only deducted on successful generation.

### Model change not taking effect
**Cause:** Model is read from `platform_settings.openrouter_model` on every request.
**Fix:** Verify the value was saved correctly in Super Admin → Platform Settings. No redeploy needed.

### Viewing edge function logs
```
Supabase Dashboard → Project → Edge Functions → ai-designer → Logs
```
Or via CLI:
```bash
npx supabase functions logs ai-designer --tail
```
