# AI Designer — Feature Documentation

**Version**: 1.0
**Added**: February 2026
**Status**: Production Ready (requires manual Supabase deployment)

---

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [User Roles & Access](#user-roles--access)
4. [Database Structure](#database-structure)
5. [Token System](#token-system)
6. [AI Generation](#ai-generation)
7. [Design Apply & Reset](#design-apply--reset)
8. [File Locations](#file-locations)
9. [Deployment Checklist](#deployment-checklist)
10. [Super Admin Setup Guide](#super-admin-setup-guide)
11. [Store Owner Guide](#store-owner-guide)
12. [Security](#security)
13. [Troubleshooting](#troubleshooting)

---

## Overview

AI Designer is a built-in AI-powered UI/UX customization tool for store owners on the Vendy-Buildr platform. Store owners can describe a design in plain English, see a live preview mockup, and publish the design to their live store — all without touching any code.

The AI (Kimi K2.5 via OpenRouter) generates CSS variable changes and layout decisions that are saved to the database and applied to the store's frontend in real time.

**Key capabilities:**
- Change store colors, typography, border radius, and section layouts via natural language
- Preview changes before publishing
- Publish AI design to live store with one click
- Reset store back to platform default design at any time
- Credit-based token system — each AI generation costs 1 token

---

## How It Works

```
Store Owner types prompt
        ↓
Frontend sends request to Edge Function (server-side)
        ↓
Edge Function checks token balance
        ↓
Edge Function fetches OpenRouter API key from platform_settings (secure)
        ↓
Kimi K2.5 AI generates design as JSON (CSS variables + layout)
        ↓
Response returned to frontend, preview updates instantly
        ↓
Token deducted from store's balance
        ↓
Store owner reviews preview → clicks Publish
        ↓
Design saved to store_design_state table
        ↓
Store frontend reads design state and applies CSS variables
```

---

## User Roles & Access

### Store Owner (Admin Panel)
- Access: `/admin/ai-designer`
- Can generate designs using purchased tokens
- Can preview designs before publishing
- Can publish design to live store
- Can reset store to platform default
- Can buy tokens at `/admin/buy-tokens`

### Super Admin
- Access: `/superadmin/ai-token-pricing`
- Creates and manages token packages (name, price, token count)
- Configures token expiry settings (duration, unit)
- Views analytics (revenue, tokens sold/used, active stores)
- Sets OpenRouter API key at `/superadmin/settings` → "AI Designer" section

---

## Database Structure

### 1. `ai_token_packages`
Stores the token packages that super admin creates and store owners can purchase.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | Package name (e.g. Basic, Pro, Enterprise) |
| description | TEXT | Short description shown to buyers |
| tokens_included | INTEGER | Number of tokens in this package |
| price | DECIMAL | Price in INR |
| is_active | BOOLEAN | Whether package is visible to buyers |
| display_order | INTEGER | Sort order in the buy page |

**Default packages inserted by migration:**
- Basic — 100 tokens — ₹199
- Pro — 500 tokens — ₹799
- Enterprise — 2000 tokens — ₹2499

---

### 2. `ai_token_purchases`
Records every token purchase made by a store. Tracks balance per purchase batch.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| store_id | UUID | Which store bought the tokens |
| user_id | UUID | Which user made the purchase |
| package_id | UUID | Which package was purchased |
| tokens_purchased | INTEGER | Total tokens in this purchase |
| tokens_used | INTEGER | How many have been used |
| tokens_remaining | INTEGER | Remaining usable tokens |
| amount_paid | DECIMAL | Amount paid in INR |
| payment_id | TEXT | Razorpay payment ID |
| expires_at | TIMESTAMP | When tokens expire (NULL if expiry disabled) |
| status | TEXT | `active`, `expired`, or `depleted` |

**Important**: A store can have multiple active purchases. The system uses the earliest-expiring active purchase first.

---

### 3. `ai_token_settings`
Singleton table (one row only) that super admin uses to control token expiry globally.

| Column | Type | Description |
|---|---|---|
| id | UUID | Always `00000000-0000-0000-0000-000000000001` |
| token_expiry_enabled | BOOLEAN | Whether tokens expire at all |
| token_expiry_duration | INTEGER | Number of months/years before expiry |
| token_expiry_unit | TEXT | `months` or `years` |

**Default**: Expiry enabled, 12 months.

---

### 4. `ai_designer_history`
Logs every AI generation request for audit and tracking purposes.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| store_id | UUID | Which store generated the design |
| user_id | UUID | Which user triggered the generation |
| prompt | TEXT | The natural language prompt entered |
| ai_response | JSONB | Full AI response (CSS variables, layout, changes) |
| tokens_used | INTEGER | Always 1 per generation |
| applied | BOOLEAN | Whether this design was published to live store |

---

### 5. `store_design_state`
Holds the currently active AI design for each store. One row per store.

| Column | Type | Description |
|---|---|---|
| store_id | UUID | Primary key, links to stores table |
| current_design | JSONB | The AI design JSON currently applied |
| last_applied_at | TIMESTAMP | When the design was last published |

**Critical**: If this row does not exist for a store, the store uses the platform's hardcoded default design (Tailwind classes in `src/index.css`). Deleting this row = instant reset to default.

---

### 6. `platform_settings` (modified)
A new column `openrouter_api_key TEXT` was added to the existing platform_settings table. This stores the OpenRouter API key securely in the database. It is never sent to the browser.

---

## Token System

### Purchasing Tokens
1. Store owner clicks "Buy Tokens" from the AI Designer page
2. Token packages fetched from `ai_token_packages` table
3. Store owner selects a package
4. Razorpay payment initiated via `create-razorpay-order` edge function
5. On payment success, a new row is inserted into `ai_token_purchases`
6. Expiry date calculated using current `ai_token_settings` values

### Using Tokens
- Each AI design generation uses exactly 1 token
- Tokens are deducted from the oldest active purchase (earliest expiry first)
- If a store has multiple active purchases, the one expiring soonest is used first

### Token Expiry
- On every balance check, the system automatically marks expired purchases as `expired` status
- Expired purchases are then deleted from the database (per design decision — no audit trail for expired tokens)
- Expiry duration is set globally by super admin in AI Token Pricing page

### Token Balance Display
- The AI Designer page shows total remaining tokens across all active purchases
- Shows the earliest expiry date (most urgent)
- If balance is 0, the generate button is disabled and a "Buy Tokens" message is shown

---

## AI Generation

### What the AI Can Change
The AI returns design changes in the form of CSS custom property (variable) values. These map directly to the platform's design system:

| CSS Variable | Controls |
|---|---|
| `--primary` | Brand color — buttons, links, active states, accents |
| `--background` | Page background color |
| `--foreground` | Main body text color |
| `--card` | Card and panel background color |
| `--muted` | Subtle section backgrounds, tags, disabled states |
| `--muted-foreground` | Secondary/grey text |
| `--border` | All border colors |
| `--radius` | Global border radius (affects all rounded corners) |

All color values must be in HSL format (e.g. `217 91% 60%`) without the `hsl()` wrapper.

The AI also returns layout preferences:
- `product_grid_cols` — number of product columns (2, 3, or 4)
- `section_padding` — spacing between sections (compact / normal / spacious)
- `hero_style` — hero section type (image or gradient)

### Preview Mockup
The preview panel shows a simplified React component that renders the store's main sections (header, hero, categories, products, CTA, footer) using the AI-generated CSS variables applied inline. It is a visual representation, not an actual iframe of the store. The mockup updates instantly when AI generates a design.

### Dark Mode
The AI also generates dark mode CSS variable values (`dark_css_variables`) which are applied under the `.dark` class selector.

---

## Design Apply & Reset

### Publishing (Apply)
When the store owner clicks "Publish Changes":
1. The pending design JSON is sent to the `ai-designer` edge function with action `apply_design`
2. The edge function upserts a row in `store_design_state` with the design JSON
3. The `ai_designer_history` record for this generation is marked as `applied = true`
4. The store's live frontend reads `store_design_state` and applies the CSS variables

### Resetting to Default
When the store owner clicks "Reset to Default":
1. The edge function is called with action `reset_design`
2. The `store_design_state` row for that store is **deleted**
3. The store frontend no longer finds a design row → falls back to hardcoded defaults in `src/index.css`
4. Store appears exactly as it did before any AI Designer was ever used

**Reset does not cost any tokens.**

---

## File Locations

### Database
| File | Purpose |
|---|---|
| `supabase/migrations/20260216000000_add_ai_designer_system.sql` | Creates all 5 new tables, RLS policies, indexes, and default data |

### Backend
| File | Purpose |
|---|---|
| `supabase/functions/ai-designer/index.ts` | Edge Function — all AI Designer server-side logic |

### Frontend — Library
| File | Purpose |
|---|---|
| `src/lib/aiDesigner.ts` | Client-side utility functions for all AI Designer API calls |

### Frontend — Store Admin Pages
| File | Purpose |
|---|---|
| `src/pages/admin/AIDesigner.tsx` | Main AI Designer page (chat + preview + token card) |
| `src/pages/admin/BuyTokens.tsx` | Token purchase page with Razorpay integration |

### Frontend — Super Admin Pages
| File | Purpose |
|---|---|
| `src/pages/superadmin/AITokenPricing.tsx` | Token package management + expiry settings + analytics |

### Frontend — Modified Files (minimal changes only)
| File | What was added |
|---|---|
| `src/components/admin/AdminLayout.tsx` | "AI Designer" nav item added after Settings |
| `src/components/superadmin/SuperAdminLayout.tsx` | "AI Token Pricing" nav item added |
| `src/App.tsx` | 3 new routes added in both subdomain and main platform sections |
| `src/pages/superadmin/PlatformSettings.tsx` | OpenRouter API key field added to settings card |

---

## Deployment Checklist

These steps must be done manually after pulling the latest code:

- [ ] **1. Run database migration**
  ```
  supabase db push
  ```
  This creates all 5 new tables with RLS policies and inserts default data.

- [ ] **2. Deploy edge function**
  ```
  supabase functions deploy ai-designer
  ```

- [ ] **3. Set OpenRouter API key**
  - Log in to Super Admin panel
  - Go to Platform Settings
  - Find "AI Designer — OpenRouter API" card
  - Paste the API key from openrouter.ai/keys
  - Click Save Changes

- [ ] **4. Verify default token packages**
  - Go to Super Admin → AI Token Pricing
  - Confirm Basic / Pro / Enterprise packages exist
  - Adjust prices if needed

- [ ] **5. Test a generation**
  - Log in as a store owner
  - Manually insert a test token purchase in the database (or buy via Razorpay)
  - Go to Admin → AI Designer
  - Enter a prompt and click Generate Design

---

## Super Admin Setup Guide

### Step 1 — Add OpenRouter API Key
1. Go to `/superadmin/settings`
2. Scroll to the "AI Designer — OpenRouter API" section
3. Enter your API key (starts with `sk-or-v1-`)
4. Click Save Changes at the top of the page
5. The key is now stored securely in the database

### Step 2 — Configure Token Packages
1. Go to `/superadmin/ai-token-pricing`
2. Three default packages exist (Basic, Pro, Enterprise)
3. Click the pencil icon on any package to edit name, tokens, or price
4. Click "Add Package" to create a new package
5. Toggle "Active" to show or hide packages from store owners

### Step 3 — Configure Token Expiry
1. On the same AI Token Pricing page, scroll to "Token Expiry Settings"
2. Toggle "Enable Token Expiry" on or off
3. Set the duration (e.g. 12) and unit (Months or Years)
4. Click Save Settings
5. This affects all future purchases — existing purchases keep their original expiry

### Step 4 — Monitor Usage
The analytics cards at the top of AI Token Pricing show:
- Total Revenue from token sales
- Total Tokens Sold
- Total Tokens Used by stores
- Number of Active Stores (with at least 1 active purchase)

---

## Store Owner Guide

### Getting Started
1. Go to Admin Panel → AI Designer (in the sidebar, below Settings)
2. The token balance card shows your current tokens and expiry date
3. If you have 0 tokens, click "Buy Tokens" to purchase a package

### Buying Tokens
1. Click "Buy Tokens" (in the token card or sidebar)
2. Choose a package (Basic / Pro / Enterprise)
3. Complete Razorpay payment
4. Tokens are added to your account instantly
5. You are redirected back to AI Designer automatically

### Generating a Design
1. In the AI Chat panel (left on desktop, toggle on mobile), type your design request
2. Examples of good prompts:
   - *"Make my store look modern with a green color theme"*
   - *"Give it a dark, minimal look with large product cards"*
   - *"Use warm orange and brown tones, more rounded corners"*
   - *"Make it look professional and clean, blue and white"*
3. Click "Generate Design"
4. Wait for the AI to respond (usually 3–8 seconds)
5. The Preview panel updates with the new design
6. The AI response shows a summary and list of changes made

### Publishing a Design
1. After reviewing the preview, click "Publish Changes" in the token card
2. Your live store now uses the AI-generated design
3. Customers will see the new design immediately

### Resetting to Default
1. Click "Reset to Default" in the token card
2. Confirm the action
3. Your store reverts to the platform's default design
4. This is free — it does not use any tokens

### Mobile Usage
On mobile devices:
- Use the `[AI Chat]` and `[Preview]` toggle buttons to switch between panels
- Only one panel is visible at a time on mobile

---

## Security

### OpenRouter API Key Protection
- The API key is stored in the `platform_settings` table in the database
- It is **never** sent to the browser or included in any client-side response
- Only the `ai-designer` Edge Function reads it, using the Supabase Service Role Key (server-side only)
- Store owners and customers cannot access the API key

### Token Quota Enforcement
- Token balance validation happens in the Edge Function, not the frontend
- The frontend cannot bypass token checks — all deductions happen server-side
- Even if a user modifies the frontend code, no generation will succeed without server-side token validation

### Row Level Security (RLS)
- Store owners can only see their own token purchases and design history
- Super admin can see all purchases for analytics
- `store_design_state` rows are publicly readable (needed for store frontend rendering) but only writable by the store owner
- Token settings and packages have public read access (needed for buy page pricing display)

---

## Troubleshooting

### "OpenRouter API key not configured"
- Super admin has not added the API key yet
- Go to Super Admin → Platform Settings → AI Designer section → add key → save

### "No tokens remaining"
- Store owner's token balance is 0
- All purchases may have expired (auto-deleted on balance check)
- Store owner needs to purchase new tokens

### Generation returns error / empty response
- OpenRouter API key may be invalid or expired
- Check the key at openrouter.ai/keys
- Ensure the `moonshotai/kimi-k2` model is available on the account

### Design not appearing on live store
- Check that `store_design_state` row exists for the store in the database
- Check that the store frontend is reading `store_design_state` on load
- The CSS variables injection happens client-side via the `buildDesignCSS` function in `src/lib/aiDesigner.ts`

### Tokens not added after payment
- Check Razorpay payment logs to confirm payment was captured
- Check `ai_token_purchases` table for a row with that store's ID
- If payment succeeded but row is missing, manually insert the purchase record with correct `store_id`, `tokens_purchased`, `tokens_remaining`, `amount_paid`, and `payment_id`

### Edge Function deployment issues
- Run `supabase functions deploy ai-designer` from the project root
- Ensure Supabase CLI is authenticated: `supabase login`
- Check function logs in Supabase dashboard under Edge Functions

---

*Documentation last updated: February 2026*
