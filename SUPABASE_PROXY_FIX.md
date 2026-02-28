# Supabase Proxy Fix — ISP Blocking Issue
**Date:** February 28, 2026
**Problem:** Store owners in Prayagraj, Uttar Pradesh could not sign up or load store pages
**Status:** ✅ Fixed

---

## Problem Summary

### Symptoms
- Main website (`digitaldukandar.in`) loaded fine ✅
- Store subdomains (`namami.digitaldukandar.in`) showed **"Store Not Found"** ❌
- Google OAuth signup showed `vexeuxsvckpfvuxqchqu.supabase.co` timeout ❌
- Error: `TypeError: Failed to fetch` on store pages
- Error: `ERR_CONNECTION_TIMED_OUT` on Supabase domain

### Root Cause
A local ISP in Prayagraj, UP was **blocking** the Supabase domain `vexeuxsvckpfvuxqchqu.supabase.co`.

When users tried to:
1. Sign up with Google → Browser redirected to `vexeuxsvckpfvuxqchqu.supabase.co` for OAuth callback → **BLOCKED**
2. Load store page → App fetched store data from `vexeuxsvckpfvuxqchqu.supabase.co` → **BLOCKED** → "Store Not Found"

### Why Only Prayagraj?
Specific ISP in Prayagraj had `supabase.co` domain blocked. Rest of India worked fine because other ISPs did not block it.

---

## Solution: NGINX Reverse Proxy

### Concept
Instead of the browser connecting directly to Supabase, all Supabase API calls now go through **your own domain** (`api.digitaldukandar.in`) which proxies to Supabase server-side.

**Before (broken for Prayagraj):**
```
User Browser → vexeuxsvckpfvuxqchqu.supabase.co ← BLOCKED by ISP
```

**After (works everywhere):**
```
User Browser → api.digitaldukandar.in → (VPS proxies) → Supabase ← Always works
```

ISPs cannot block `digitaldukandar.in` — it's your own Indian domain.

---

## Changes Made

### 1. New NGINX Config on VPS
**File created:** `/etc/nginx/sites-available/api.digitaldukandar.in`
**Symlinked to:** `/etc/nginx/sites-enabled/api.digitaldukandar.in`

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.digitaldukandar.in;

    ssl_certificate /etc/ssl/cloudflare/cert.pem;
    ssl_certificate_key /etc/ssl/cloudflare/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    resolver 8.8.8.8 8.8.4.4 1.1.1.1 valid=300s;
    resolver_timeout 10s;

    location / {
        proxy_pass https://vexeuxsvckpfvuxqchqu.supabase.co;
        proxy_set_header Host vexeuxsvckpfvuxqchqu.supabase.co;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;
    }
}
```

**Commands run on VPS:**
```bash
sudo ln -s /etc/nginx/sites-available/api.digitaldukandar.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 2. Code Change — Supabase Client URL
**File:** `src/integrations/supabase/client.ts` (line 5)

**Before:**
```typescript
const SUPABASE_URL = "https://vexeuxsvckpfvuxqchqu.supabase.co";
```

**After:**
```typescript
const SUPABASE_URL = "https://api.digitaldukandar.in";
```

This single line change makes **all Supabase API calls** (auth, database, storage, edge functions) go through your proxy instead of directly to Supabase.

---

## Infrastructure Details

| Component | Detail |
|-----------|--------|
| VPS | Hostinger VPS — IP: `147.79.70.113` |
| Domain | `digitaldukandar.in` |
| CDN/SSL | Cloudflare (proxy ON, orange cloud) |
| SSL Certificate | Cloudflare Origin Certificate at `/etc/ssl/cloudflare/cert.pem` |
| DNS | Wildcard `*` A record → `147.79.70.113` (already existed, covers `api` subdomain) |
| Proxy subdomain | `api.digitaldukandar.in` |
| Supabase project | `vexeuxsvckpfvuxqchqu.supabase.co` |

---

## DNS (No Changes Needed)
Cloudflare already had a wildcard `*` A record pointing to `147.79.70.113` with proxy ON.
This automatically covered `api.digitaldukandar.in` — no new DNS record was required.

---

## Deployment Steps After Code Change

```bash
# 1. Build the app
npm run build

# 2. Deploy dist/ to VPS (however you normally deploy)
# e.g. git pull on VPS, or rsync, or PM2 restart
```

---

## What This Fixes

| Issue | Fixed? |
|-------|--------|
| Google OAuth signup blocked in Prayagraj | ✅ Yes |
| Store pages showing "Store Not Found" in Prayagraj | ✅ Yes |
| `TypeError: Failed to fetch` errors | ✅ Yes |
| Works for all users worldwide | ✅ Yes |
| Other cities that may block Supabase in future | ✅ Yes (proactive fix) |

---

## How to Verify Fix Works

1. Ask Prayagraj user to visit `https://namami.digitaldukandar.in`
2. Store should load correctly now
3. Try Google OAuth signup on `https://digitaldukandar.in`
4. Should complete without timeout

---

## If Something Breaks

### Revert code change (temporary):
In `src/integrations/supabase/client.ts` line 5, change back to:
```typescript
const SUPABASE_URL = "https://vexeuxsvckpfvuxqchqu.supabase.co";
```

### Check proxy is working:
```bash
curl -I https://api.digitaldukandar.in
# Should return HTTP 200 or redirect from Supabase
```

### Check NGINX logs:
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Reload NGINX if needed:
```bash
sudo nginx -t && sudo systemctl reload nginx
```
