# Instagram API Integration - Complete Setup Guide

## Overview

This document contains the complete setup process for Instagram API integration in the Digital Dukandar platform. This enables store owners to connect their Instagram Business accounts with one-click and use auto-reply features.

---

## Table of Contents

1. [Credentials & Configuration](#credentials--configuration)
2. [Facebook Developer App Setup](#facebook-developer-app-setup)
3. [Instagram API Configuration](#instagram-api-configuration)
4. [Supabase Setup](#supabase-setup)
5. [Edge Functions](#edge-functions)
6. [Database Schema](#database-schema)
7. [Frontend Components](#frontend-components)
8. [How It Works](#how-it-works)
9. [Token Management](#token-management)
10. [Troubleshooting](#troubleshooting)

---

## Credentials & Configuration

### Facebook/Instagram App Credentials

| Credential | Value |
|------------|-------|
| **App Name** | digitaldukandar.in |
| **App ID** | `3040251989496492` |
| **App Secret** | `33acbd34630168e7c5edd74f3f1f9985` |
| **Instagram App ID** | `3040251989496492` |

### Supabase Secrets (Edge Functions)

| Secret Name | Value |
|-------------|-------|
| `INSTAGRAM_APP_ID` | `3040251989496492` |
| `INSTAGRAM_APP_SECRET` | `33acbd34630168e7c5edd74f3f1f9985` |
| `FRONTEND_URL` | `https://digitaldukandar.in` |

### URLs Configured

| Purpose | URL |
|---------|-----|
| **OAuth Redirect URI** | `https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/instagram-oauth` |
| **Webhook Callback URL** | `https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/hyper-service` |
| **Webhook Verify Token** | `digitaldukandar_verify_2024` |

---

## Facebook Developer App Setup

### Step 1: Create Facebook Developer Account

1. Go to https://developers.facebook.com
2. Click "Get Started" or "My Apps"
3. Login with Facebook account
4. Complete developer registration

### Step 2: Create New App

1. Click "Create App"
2. **App Details:**
   - App Name: `digitaldukandar.in`
   - Contact Email: Your email
3. **Use Cases:** Select these two:
   - ✅ Manage messaging & content on Instagram
   - ✅ Engage with customers on Messenger from Meta
4. **Business Portfolio:** Select or create one (e.g., "Mayur Bagewadi's business")
5. Click "Create App"

### Step 3: Add Instagram Tester

1. Go to **App roles** → **Roles**
2. Click **"Instagram Testers"** tab
3. Click **"Add People"**
4. Enter Instagram username
5. On Instagram app: **Settings → Apps and websites → Tester invites → Accept**

### Step 4: Configure Permissions

1. Go to **Use cases** → **Instagram** → **Customize**
2. Click **"Add all required permissions"**
3. Permissions added:
   - `instagram_business_basic`
   - `instagram_manage_comments`
   - `instagram_business_manage_messages`

### Step 5: Generate Access Token (For Testing)

1. In Instagram API setup page
2. Click **"Add account"**
3. Login with Instagram
4. Authorize permissions
5. Copy the access token (for manual testing)

### Step 6: Configure Webhooks

1. Scroll to **"3. Configure webhooks"**
2. Enter:
   - **Callback URL:** `https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/hyper-service`
   - **Verify Token:** `digitaldukandar_verify_2024`
3. Click **"Verify and save"**

### Step 7: Set Up Instagram Business Login

1. Click **"Set up"** button in step 4
2. Enter **Redirect URL:** `https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/instagram-oauth`
3. Click **"Save"**

### Step 8: Configure Facebook Login Settings

1. Go to **Facebook Login for Business** → **Settings**
2. Add to **Valid OAuth Redirect URIs:**
   ```
   https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/instagram-oauth
   ```
3. Enable:
   - ✅ Client OAuth login
   - ✅ Web OAuth login
   - ✅ Enforce HTTPS
4. Click **"Save Changes"**

### Step 9: Business Login Settings (For App Review)

1. Click **"Business login settings"**
2. Add:
   - **Deauthorize callback URL:** `https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/instagram-oauth?action=deauthorize`
   - **Data deletion request URL:** `https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/instagram-oauth?action=delete-data`
3. Save

---

## Instagram API Configuration

### API Permissions Required

| Permission | Purpose |
|------------|---------|
| `instagram_business_basic` | Read account info |
| `instagram_business_manage_messages` | Send/receive DMs |
| `instagram_business_manage_comments` | Reply to comments |
| `instagram_business_content_publish` | Post content |
| `instagram_business_manage_insights` | View analytics |

### OAuth Scopes (Embed URL)

```
https://www.instagram.com/oauth/authorize
  ?client_id=3040251989496492
  &redirect_uri=https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/instagram-oauth
  &scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish
  &response_type=code
```

---

## Supabase Setup

### Step 1: Add Edge Function Secrets

1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions**
2. Click **"Manage Secrets"**
3. Add these secrets:

| Name | Value |
|------|-------|
| `INSTAGRAM_APP_ID` | `3040251989496492` |
| `INSTAGRAM_APP_SECRET` | `33acbd34630168e7c5edd74f3f1f9985` |
| `FRONTEND_URL` | `https://digitaldukandar.in` |

### Step 2: Deploy Edge Functions

#### Function 1: instagram-oauth

- **Name:** `instagram-oauth`
- **File:** `supabase/functions/instagram-oauth/index.ts`
- **JWT Verification:** DISABLED (public endpoint)
- **Purpose:** Handle OAuth connect/disconnect/refresh

#### Function 2: instagram-webhook (hyper-service)

- **Name:** `hyper-service` (or `instagram-webhook`)
- **File:** `supabase/functions/instagram-webhook/index.ts`
- **JWT Verification:** DISABLED (receives webhook from Facebook)
- **Purpose:** Receive Instagram messages/events

### Step 3: Run Database Migration

Run this SQL in **Supabase SQL Editor:**

```sql
-- Add Instagram fields to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram_business_id TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram_access_token TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram_token_expiry TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram_username TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS auto_reply_settings JSONB DEFAULT '{"enabled": false, "default_message": "Thanks for your message! We will get back to you soon.", "rules": []}';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS comment_auto_reply_settings JSONB DEFAULT '{"enabled": false, "default_reply": "Thanks for your comment!"}';

-- Instagram Messages Table
CREATE TABLE IF NOT EXISTS instagram_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  message_id TEXT,
  message_text TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  is_auto_reply BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Instagram Comments Table
CREATE TABLE IF NOT EXISTS instagram_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_id TEXT NOT NULL,
  comment_id TEXT NOT NULL UNIQUE,
  comment_text TEXT,
  from_id TEXT,
  from_username TEXT,
  media_id TEXT,
  replied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_instagram_messages_instagram_id ON instagram_messages(instagram_id);
CREATE INDEX IF NOT EXISTS idx_instagram_messages_sender_id ON instagram_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_instagram_messages_timestamp ON instagram_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_comments_instagram_id ON instagram_comments(instagram_id);
CREATE INDEX IF NOT EXISTS idx_stores_instagram_business_id ON stores(instagram_business_id);
```

---

## Edge Functions

### 1. Instagram OAuth Function

**File:** `supabase/functions/instagram-oauth/index.ts`

**Endpoints:**

| Action | URL | Purpose |
|--------|-----|---------|
| Connect | `?action=connect&store_id=XXX` | Start OAuth flow |
| Callback | `?code=XXX&state=store_id` | Handle OAuth callback |
| Refresh | `?action=refresh&store_id=XXX` | Refresh token |
| Disconnect | `?action=disconnect&store_id=XXX` | Remove connection |

**Flow:**
```
1. User clicks "Connect Instagram"
2. Redirects to Instagram OAuth
3. User authorizes
4. Instagram redirects back with code
5. Function exchanges code for token
6. Token saved to database
7. User redirected to admin panel
```

### 2. Instagram Webhook Function

**File:** `supabase/functions/instagram-webhook/index.ts`

**Endpoints:**

| Method | Purpose |
|--------|---------|
| GET | Webhook verification (Facebook challenge) |
| POST | Receive messages, comments, mentions |

**Events Handled:**
- `messages` - Direct messages
- `messaging_postbacks` - Button clicks
- `comments` - Comment notifications
- `mentions` - @mentions

---

## Database Schema

### Stores Table (New Columns)

| Column | Type | Description |
|--------|------|-------------|
| `instagram_business_id` | TEXT | Instagram Business Account ID |
| `instagram_access_token` | TEXT | OAuth access token |
| `instagram_token_expiry` | TIMESTAMPTZ | When token expires |
| `instagram_username` | TEXT | @username |
| `instagram_connected` | BOOLEAN | Connection status |
| `auto_reply_settings` | JSONB | DM auto-reply config |
| `comment_auto_reply_settings` | JSONB | Comment auto-reply config |

### Auto Reply Settings Structure

```json
{
  "enabled": true,
  "default_message": "Thanks for your message! We'll get back to you soon.",
  "rules": [
    {
      "id": "1234567890",
      "keywords": ["price", "cost", "how much"],
      "reply": "Please check our website for prices!"
    },
    {
      "id": "1234567891",
      "keywords": ["hours", "open", "timing"],
      "reply": "We're open 9 AM to 9 PM, Monday to Saturday."
    }
  ]
}
```

### Instagram Messages Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `instagram_id` | TEXT | Store's Instagram ID |
| `sender_id` | TEXT | Message sender |
| `recipient_id` | TEXT | Message recipient |
| `message_id` | TEXT | Instagram message ID |
| `message_text` | TEXT | Message content |
| `timestamp` | TIMESTAMPTZ | When sent |
| `direction` | TEXT | 'incoming' or 'outgoing' |
| `is_auto_reply` | BOOLEAN | Was auto-generated |

---

## Frontend Components

### Admin Page

**File:** `src/pages/admin/growth/Instagram.tsx`

**Route:** `/admin/growth/instagram`

**Features:**
- Connect/Disconnect Instagram button
- Token expiry warning
- Refresh token button
- DM auto-reply settings
- Comment auto-reply settings
- Keyword rules management

### Menu Location

**File:** `src/components/admin/AdminLayout.tsx`

**Location:** Growth → Instagram (in sidebar dropdown)

---

## How It Works

### Store Owner Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    STORE OWNER EXPERIENCE                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Go to Admin Panel → Growth → Instagram                   │
│     ↓                                                        │
│  2. Click "Connect Instagram" button                         │
│     ↓                                                        │
│  3. Instagram login popup appears                            │
│     ↓                                                        │
│  4. Authorize permissions                                    │
│     ↓                                                        │
│  5. Redirected back - "Connected" status shown               │
│     ↓                                                        │
│  6. Configure auto-reply settings                            │
│     ↓                                                        │
│  7. Done! Auto-replies work automatically                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Auto-Reply Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTO-REPLY FLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Customer sends DM to store's Instagram                   │
│     ↓                                                        │
│  2. Instagram sends webhook to our server                    │
│     ↓                                                        │
│  3. Webhook function receives message                        │
│     ↓                                                        │
│  4. Lookup store by instagram_business_id                    │
│     ↓                                                        │
│  5. Check auto_reply_settings                                │
│     ↓                                                        │
│  6. Match keywords → Use keyword reply                       │
│     No match → Use default message                           │
│     ↓                                                        │
│  7. Send reply via Instagram API                             │
│     ↓                                                        │
│  8. Store message in database                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Token Management

### Token Lifecycle

| Event | Duration |
|-------|----------|
| **Initial Token** | Valid for 60 days |
| **After Refresh** | Extended by 60 days |
| **Warning Shown** | When < 7 days remaining |

### Manual Refresh

Store owners can click "Refresh Token" button in Instagram settings.

### Automatic Refresh (Optional)

Create a scheduled Edge Function that runs daily and refreshes expiring tokens.

```typescript
// Check all stores with tokens expiring in 7 days
// Call instagram-oauth?action=refresh&store_id=XXX for each
```

---

## App Review Process (For Live Mode)

### When Needed

- Development Mode: Only you + 50 testers can connect
- Live Mode: All Instagram users can connect (requires App Review)

### Steps to Submit

1. Go to **App Review** → **Permissions and Features**
2. Request these permissions:
   - `instagram_business_basic`
   - `instagram_business_manage_messages`
   - `instagram_business_manage_comments`
3. Provide:
   - **Screen recording** showing how app uses Instagram
   - **Privacy Policy URL:** `https://digitaldukandar.in/privacy-policy`
   - **Terms of Service URL:** `https://digitaldukandar.in/terms-of-service`
   - **Detailed explanation** of use case
4. Submit for review
5. Wait for approval (usually 1-5 business days)

---

## Troubleshooting

### Error: "Insufficient developer role"

**Fix:** Add Instagram account as Instagram Tester in App roles

### Error: "Activity off Meta technologies is turned off"

**Fix:**
1. Go to facebook.com/off_facebook_activity
2. Enable "Future Activity"

### Error: "column instagram_connected does not exist"

**Fix:** Run the database migration SQL in Supabase

### Error: "Token expired"

**Fix:** Click "Refresh Token" button or reconnect Instagram

### Webhook not receiving messages

**Fix:**
1. Check webhook is verified (green checkmark)
2. Ensure app is in Live mode OR use test account
3. Check Edge Function logs in Supabase

---

## File Locations

| File | Purpose |
|------|---------|
| `src/pages/admin/growth/Instagram.tsx` | Admin UI page |
| `src/components/admin/AdminLayout.tsx` | Menu with Instagram link |
| `supabase/functions/instagram-oauth/index.ts` | OAuth Edge Function |
| `supabase/functions/instagram-webhook/index.ts` | Webhook Edge Function |
| `supabase/migrations/20251231100000_instagram_messaging.sql` | Database migration |
| `docs/INSTAGRAM_API_SETUP.md` | This documentation |

---

## Quick Reference

### Important URLs

```
Facebook Developer Dashboard:
https://developers.facebook.com/apps/3040251989496492/

Supabase Project:
https://supabase.com/dashboard/project/vexeuxsvckpfvuxqchqu

Instagram OAuth Endpoint:
https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/instagram-oauth

Webhook Endpoint:
https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/hyper-service

Admin Instagram Page:
https://digitaldukandar.in/admin/growth/instagram
```

### Test Webhook Verification

```
https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/hyper-service?hub.mode=subscribe&hub.verify_token=digitaldukandar_verify_2024&hub.challenge=test123
```

Should return: `test123`

---

## Security Notes

1. **App Secret** - Never expose in frontend code, only in Supabase secrets
2. **Access Tokens** - Stored encrypted in database, never sent to client
3. **Webhook Verify Token** - Used to validate requests are from Facebook
4. **OAuth State** - Contains store_id to prevent CSRF attacks

---

*Last Updated: December 31, 2025*
*Created by: Claude Code*
