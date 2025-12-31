# Google Drive Image Loading System

## Overview

This document explains how product and store images are loaded from Google Drive in the application.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Image Loading Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Database stores Google Drive share links                     │
│     ↓                                                            │
│  2. Component receives raw URL from database                     │
│     ↓                                                            │
│  3. LazyImage converts URL using convertToDirectImageUrl()       │
│     ↓                                                            │
│  4. Browser loads image from converted direct URL                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/imageUtils.ts` | URL conversion utility |
| `src/components/ui/lazy-image.tsx` | Lazy loading image component with auto-conversion |
| `supabase/functions/upload-to-drive/index.ts` | Server-side upload to Google Drive |
| `src/pages/admin/Settings.tsx` | Google Drive OAuth connection UI |

---

## How URL Conversion Works

### The Problem

Google Drive share links don't work directly in `<img>` tags:

```
❌ https://drive.google.com/file/d/FILE_ID/view?usp=sharing
❌ https://drive.google.com/open?id=FILE_ID
```

### The Solution

Convert share links to Google Drive's thumbnail API:

```
✅ https://drive.google.com/thumbnail?id=FILE_ID&sz=w1000
```

### Code: `src/lib/imageUtils.ts`

```typescript
/**
 * Converts Google Drive share links to direct image URLs
 * @param url - The image URL (can be Google Drive link or direct URL)
 * @returns Direct image URL that can be used in img src
 */
export const convertToDirectImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;

  // If it's already a direct Google Drive link, return it
  if (url.includes('drive.google.com/thumbnail?') || url.includes('drive.google.com/uc?')) {
    return url;
  }

  // Convert Google Drive share link to direct link using thumbnail API
  // Handles both formats: /d/FILE_ID and ?id=FILE_ID
  const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
  if (fileIdMatch) {
    const fileId = fileIdMatch[1] || fileIdMatch[2];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }

  // If it's not a Google Drive link, return as is
  return url;
};
```

### URL Format Examples

| Input URL | Extracted File ID | Output URL |
|-----------|-------------------|------------|
| `https://drive.google.com/file/d/ABC123/view` | `ABC123` | `https://drive.google.com/thumbnail?id=ABC123&sz=w1000` |
| `https://drive.google.com/open?id=XYZ789` | `XYZ789` | `https://drive.google.com/thumbnail?id=XYZ789&sz=w1000` |
| `https://example.com/image.jpg` | N/A | `https://example.com/image.jpg` (unchanged) |

---

## LazyImage Component

### Location: `src/components/ui/lazy-image.tsx`

### Features

1. **Lazy Loading** - Images load only when visible in viewport
2. **Auto URL Conversion** - Automatically converts Google Drive URLs
3. **Fallback Support** - Shows placeholder on error
4. **Loading State** - Smooth opacity transition

### Code Flow

```typescript
const LazyImage = ({ src, alt, className, fallback = "/placeholder.svg", ...props }) => {
  // 1. Convert Google Drive URL to direct URL
  const directSrc = convertToDirectImageUrl(src) || src;

  // 2. Intersection Observer detects when image enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entry.isIntersecting) {
        setIsInView(true);  // Trigger image load
      }
    });
    observer.observe(imgRef.current);
  }, []);

  // 3. Load image when in view
  useEffect(() => {
    if (!isInView) return;

    const img = new Image();
    img.src = directSrc;  // Use converted URL

    img.onload = () => setImageSrc(directSrc);
    img.onerror = () => setImageSrc(fallback);
  }, [directSrc, isInView]);

  return <img src={imageSrc} alt={alt} />;
};
```

---

## Upload Flow (Server-Side)

### Location: `supabase/functions/upload-to-drive/index.ts`

### Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Upload Process                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. User selects image file in AddProduct/EditProduct         │
│     ↓                                                         │
│  2. Frontend calls upload-to-drive Edge Function              │
│     ↓                                                         │
│  3. Function retrieves user's Google OAuth tokens from DB     │
│     ↓                                                         │
│  4. Function uploads file to user's Google Drive              │
│     ↓                                                         │
│  5. Function sets file permission to "anyone can view"        │
│     ↓                                                         │
│  6. Function returns thumbnail URL to frontend                │
│     ↓                                                         │
│  7. Frontend saves URL to product.images array                │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Token Refresh

The function automatically refreshes expired OAuth tokens:

```typescript
if (tokenExpiry && now >= tokenExpiry) {
  // Refresh the token using Google OAuth API
  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: store.google_refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  // Update store with new token
  await supabase.from('stores').update({
    google_access_token: newToken,
    google_token_expiry: newExpiry,
  });
}
```

---

## Google Drive Connection (OAuth)

### Location: `src/pages/admin/Settings.tsx`

### Connection Flow

```
┌──────────────────────────────────────────────────────────────┐
│                 Google Drive OAuth Flow                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. User clicks "Connect Google Drive" button                 │
│     ↓                                                         │
│  2. Supabase OAuth redirects to Google consent screen         │
│     ↓                                                         │
│  3. User grants "drive.file" permission                       │
│     ↓                                                         │
│  4. Google redirects back with auth code                      │
│     ↓                                                         │
│  5. Supabase exchanges code for access + refresh tokens       │
│     ↓                                                         │
│  6. Settings page saves tokens to stores table                │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Code

```typescript
const handleConnectGoogleDrive = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/admin/settings`,
      scopes: 'https://www.googleapis.com/auth/drive.file',
      queryParams: {
        access_type: 'offline',  // Get refresh token
        prompt: 'consent',       // Always show consent screen
      },
    },
  });
};
```

---

## Database Schema

### Stores Table - Google Drive Fields

| Column | Type | Purpose |
|--------|------|---------|
| `google_access_token` | TEXT | OAuth access token |
| `google_refresh_token` | TEXT | OAuth refresh token (for renewal) |
| `google_token_expiry` | TIMESTAMP | When access token expires |

### Products Table - Image Storage

| Column | Type | Purpose |
|--------|------|---------|
| `images` | TEXT[] | Array of image URLs (Google Drive or direct) |

---

## Components Using Image Loading

| Component | File | Usage |
|-----------|------|-------|
| ProductCard | `src/components/customer/ProductCard.tsx` | Product grid thumbnails |
| ProductDetail | `src/pages/customer/ProductDetail.tsx` | Product page gallery |
| CategoryCard | `src/components/customer/CategoryCard.tsx` | Category thumbnails |
| HeroBannerCarousel | `src/components/customer/HeroBannerCarousel.tsx` | Store banners |
| CategoryManager | `src/components/admin/CategoryManager.tsx` | Admin category images |

---

## Troubleshooting

### Images Not Loading

1. **Check URL format** - Ensure Google Drive link contains file ID
2. **Check permissions** - File must be "Anyone with link can view"
3. **Check OAuth** - User must have connected Google Drive in Settings
4. **Check token expiry** - Tokens auto-refresh but may fail if refresh token is revoked

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 403 Forbidden | File not shared publicly | Set file to "Anyone with link" |
| 404 Not Found | Invalid file ID | Re-upload file |
| Token expired | OAuth token expired | Reconnect Google Drive in Settings |

---

## Environment Variables (Edge Functions)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |

---

## Size Parameter

The `sz=w1000` parameter in the thumbnail URL controls image width:

| Parameter | Output Size |
|-----------|-------------|
| `sz=w200` | 200px width |
| `sz=w500` | 500px width |
| `sz=w1000` | 1000px width (default) |
| `sz=w2000` | 2000px width |

Current default: `w1000` (good balance of quality and performance)

---

## Security Notes

1. **OAuth tokens** are stored in database, not client-side
2. **Refresh tokens** allow long-term access without re-authentication
3. **drive.file scope** limits access to only files created by the app
4. **Public sharing** is set per-file, not account-wide
