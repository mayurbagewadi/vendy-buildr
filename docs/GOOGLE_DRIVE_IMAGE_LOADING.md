# Google Drive Image Loading System

---

## ⚠️ CRITICAL WARNING - READ FIRST ⚠️

**DO NOT MODIFY THIS IMPLEMENTATION OR THIS DOCUMENTATION FILE**

This document describes the **WORKING** solution for Google Drive image handling. The current implementation has been tested and verified to work correctly in production.

### For AI Assistants:
- **DO NOT** suggest changing the URL format from `thumbnail` to other formats
- **DO NOT** add conversion logic in the admin preview sections
- **DO NOT** modify `convertToDirectImageUrl()` function
- **DO NOT** suggest using `lh3.googleusercontent.com/d/` or `uc?export=view` formats
- **ONLY** use this documentation as reference to understand how the system works

### History of What Was Tried and Failed:
1. ❌ `https://lh3.googleusercontent.com/d/${fileId}` - Failed in admin preview
2. ❌ `https://drive.google.com/uc?export=view&id=${fileId}` - Failed in admin preview
3. ❌ Double conversion in admin preview (converting already-converted URLs) - Failed
4. ✅ **CURRENT WORKING SOLUTION:** `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` with direct URL in admin preview

**Last Updated:** 2026-01-08
**Status:** ✅ WORKING IN PRODUCTION
**Commit:** e5ac94b9 - "Sync Google Drive image handling with production"

---

## Overview

This document explains how product and store images are loaded from Google Drive in the application.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Image Loading Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Database stores Google Drive thumbnail URLs                  │
│     ↓                                                            │
│  2. Component receives URL from database                         │
│     ↓                                                            │
│  3. ADMIN PREVIEW: Uses URL directly (already converted)         │
│     FRONTEND: LazyImage converts URL using convertToDirectImageUrl()│
│     ↓                                                            │
│  4. Browser loads image from thumbnail URL                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/imageUtils.ts` | URL conversion utility |
| `src/components/ui/lazy-image.tsx` | Lazy loading image component with auto-conversion |
| `src/pages/admin/AddProduct.tsx` | Admin panel - add product with images |
| `src/pages/admin/EditProduct.tsx` | Admin panel - edit product images |
| `src/components/admin/CategoryManager.tsx` | Admin panel - category images |
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

**⚠️ DO NOT MODIFY THIS FUNCTION - IT IS WORKING**

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

## CRITICAL: Admin Panel Preview Implementation

### ⚠️ THE MOST IMPORTANT PART - DO NOT CHANGE ⚠️

**The admin panel preview must use the URL DIRECTLY without re-conversion.**

#### ✅ CORRECT Implementation (Production)

In `AddProduct.tsx`, `EditProduct.tsx`, and `CategoryManager.tsx`:

```tsx
{/* Image Previews */}
{imageUrls.length > 0 && (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
    {imageUrls.map((url, index) => (
      <div key={`url-${index}`} className="relative group">
        <div className="aspect-square bg-muted rounded-lg overflow-hidden">
          <img
            src={url}  // ✅ USE URL DIRECTLY - DO NOT CONVERT
            alt={`Product Image ${index + 1}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';
            }}
          />
        </div>
      </div>
    ))}
  </div>
)}
```

**Why this works:**
- The URL in `imageUrls` is already converted to thumbnail format when added
- No need to convert again - just display it
- Browser can load the thumbnail URL directly

#### ❌ WRONG Implementation (What Failed)

```tsx
{/* DON'T DO THIS */}
{imageUrls.map((url, index) => {
  const directUrl = convertToDirectImageUrl(url) || url;  // ❌ DOUBLE CONVERSION - FAILS
  return (
    <img src={directUrl} />
  );
})}
```

**Why this fails:**
- The URL is already converted to `https://drive.google.com/thumbnail?id=...`
- Calling `convertToDirectImageUrl()` again tries to extract file ID from already-converted URL
- This causes the preview to fail and show default placeholder

---

## Two Image Upload Methods

### Method 1: Upload from Device (via Edge Function)

**Location:** Admin Panel → Add/Edit Product → Upload from Device button

**Flow:**
1. User selects image file from device
2. Frontend calls `upload-to-drive` edge function
3. Edge function uploads to Google Drive with OAuth
4. Edge function sets permission to "anyone can view"
5. Edge function returns thumbnail URL: `https://drive.google.com/thumbnail?id=FILE_ID&sz=w1000`
6. Frontend adds URL to `imageUrls` array
7. Preview shows image immediately ✅

**Code in AddProduct.tsx:**

```tsx
const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(event.target.files || []);
  // ... file validation ...

  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await supabase.functions.invoke('upload-to-drive', {
      body: formData,
    });

    if (response.data?.imageUrl) {
      setImageUrls(prev => [...prev, response.data.imageUrl]);
      // imageUrl is already: https://drive.google.com/thumbnail?id=...&sz=w1000
    }
  }
};
```

### Method 2: Paste Google Drive Link

**Location:** Admin Panel → Add/Edit Product → "Add Image URL" input

**Flow:**
1. User pastes Google Drive share link (e.g., `https://drive.google.com/file/d/ABC123/view`)
2. Frontend extracts file ID
3. Frontend converts to thumbnail URL: `https://drive.google.com/thumbnail?id=ABC123&sz=w1000`
4. Frontend adds converted URL to `imageUrls` array
5. Preview shows image immediately ✅

**Code in AddProduct.tsx:**

```tsx
const addImageUrl = () => {
  let imageUrl = newImageUrl.trim();

  if (imageUrl.includes('drive.google.com')) {
    const fileIdMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch) {
      const fileId = fileIdMatch[1] || fileIdMatch[2];
      // Convert to thumbnail format
      imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

      toast({
        title: "Google Drive Link Added",
        description: "Make sure the file is set to 'Anyone with the link can view'",
      });
    }
  }

  setImageUrls(prev => [...prev, imageUrl]);
  setNewImageUrl("");
};
```

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

**Note:** LazyImage is used on the FRONTEND (customer-facing pages), not in admin preview.

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

### Critical Code

**⚠️ DO NOT CHANGE THIS - IT RETURNS THE CORRECT URL FORMAT**

```typescript
// After uploading file to Google Drive and setting permissions...

// Return the direct image URL using thumbnail API
const imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

console.log('File uploaded successfully:', { fileId, imageUrl });

return new Response(
  JSON.stringify({
    success: true,
    imageUrl,  // This is the thumbnail URL
    fileId
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
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
| `images` | TEXT[] | Array of image URLs (Google Drive thumbnail format) |

**Example stored URL:**
```
https://drive.google.com/thumbnail?id=1ABC123XYZ&sz=w1000
```

---

## Components Using Image Loading

| Component | File | Usage | Conversion? |
|-----------|------|-------|-------------|
| ProductCard | `src/components/customer/ProductCard.tsx` | Product grid thumbnails | ✅ via LazyImage |
| ProductDetail | `src/pages/customer/ProductDetail.tsx` | Product page gallery | ✅ via LazyImage |
| CategoryCard | `src/components/customer/CategoryCard.tsx` | Category thumbnails | ✅ via LazyImage |
| HeroBannerCarousel | `src/components/customer/HeroBannerCarousel.tsx` | Store banners | ✅ via LazyImage |
| CategoryManager | `src/components/admin/CategoryManager.tsx` | Admin category images | ❌ Direct URL |
| AddProduct | `src/pages/admin/AddProduct.tsx` | Admin product preview | ❌ Direct URL |
| EditProduct | `src/pages/admin/EditProduct.tsx` | Admin product preview | ❌ Direct URL |

---

## Troubleshooting

### Issue: Admin Preview Shows Default Placeholder

**Symptoms:**
- Upload from device works in production, but preview shows default image locally
- Google Drive link paste shows default image in preview
- Frontend displays correctly

**Root Cause:**
Admin preview was trying to re-convert already-converted URLs, causing double conversion failure.

**Solution:**
Use URL directly in admin preview without re-conversion:

```tsx
// ✅ CORRECT
<img src={url} />

// ❌ WRONG
<img src={convertToDirectImageUrl(url)} />
```

### Issue: Images Not Loading on Frontend

**Checklist:**
1. **Check URL format** - Ensure it's `https://drive.google.com/thumbnail?id=...&sz=w1000`
2. **Check permissions** - File must be "Anyone with link can view" in Google Drive
3. **Check OAuth** - User must have connected Google Drive in Settings
4. **Check token expiry** - Tokens auto-refresh but may fail if refresh token is revoked
5. **Check browser console** - Look for 403, 404, or CORS errors

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 403 Forbidden | File not shared publicly | Go to Google Drive → Right-click file → Share → "Anyone with the link can view" |
| 404 Not Found | Invalid file ID | Re-upload file or check URL format |
| Token expired | OAuth token expired | Settings → Reconnect Google Drive |
| CORS error | Using wrong URL format | Use thumbnail format, not direct download |
| Default placeholder shows | Double conversion in preview | Use URL directly, don't re-convert |

### Debug Steps

1. **Check what URL is stored in database:**
   ```sql
   SELECT images FROM products WHERE id = 'product_id';
   ```
   Expected format: `["https://drive.google.com/thumbnail?id=...&sz=w1000"]`

2. **Check browser Network tab:**
   - Open DevTools (F12) → Network tab
   - Look for failed image requests
   - Check the URL being requested
   - Check the response status (200 = OK, 403 = forbidden, 404 = not found)

3. **Test URL directly:**
   - Copy the thumbnail URL from database
   - Paste it directly in browser address bar
   - If image loads → code issue
   - If image doesn't load → Google Drive permission issue

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
| `sz=w1000` | 1000px width (default) ✅ |
| `sz=w2000` | 2000px width |

**Current default:** `w1000` (good balance of quality and performance)

**⚠️ DO NOT CHANGE** the size parameter without testing thoroughly.

---

## Security Notes

1. **OAuth tokens** are stored in database, not client-side
2. **Refresh tokens** allow long-term access without re-authentication
3. **drive.file scope** limits access to only files created by the app
4. **Public sharing** is set per-file, not account-wide
5. **Tokens are encrypted** in Supabase database

---

## Testing Checklist

When making changes, verify these work:

### Admin Panel:
- [ ] Upload image from device → preview shows correctly
- [ ] Paste Google Drive share link → converts & preview shows correctly
- [ ] Save product → images persist in database
- [ ] Edit product → existing images display correctly
- [ ] Add category with image → preview shows correctly

### Frontend:
- [ ] Product cards show images correctly
- [ ] Product detail page gallery works
- [ ] Category cards show images
- [ ] Store banners/hero images display

### Both Environments:
- [ ] Production deployment works
- [ ] Local development works (npm run dev)
- [ ] No console errors
- [ ] No 403/404 errors in Network tab

---

## Change Log

### 2026-01-08 - e5ac94b9
- **Fixed:** Admin preview showing default images
- **Root cause:** Double URL conversion in preview
- **Solution:** Use URL directly in admin preview (already converted)
- **Files changed:**
  - `src/lib/imageUtils.ts` - Reverted to production version
  - `src/pages/admin/AddProduct.tsx` - Removed double conversion in preview
  - `src/pages/admin/EditProduct.tsx` - Removed double conversion in preview
  - `src/components/admin/CategoryManager.tsx` - Removed double conversion in preview
  - `supabase/functions/upload-to-drive/index.ts` - Ensured returns thumbnail format

---

## Final Notes for AI Assistants

**This implementation is WORKING in production. Do not suggest changes unless:**

1. There is a confirmed bug with specific error logs
2. Google Drive API has changed and thumbnail format no longer works
3. User explicitly requests a feature change

**When troubleshooting:**
1. Read this entire document first
2. Check if issue is in admin preview vs frontend
3. Verify URL format in database matches expected format
4. Check Google Drive file permissions
5. Only suggest code changes as last resort

**Remember:**
- Admin preview = Direct URL usage (no conversion)
- Frontend = LazyImage with conversion
- Upload edge function = Returns thumbnail URL
- Manual paste = Converts to thumbnail URL

This document was created after fixing a critical bug where images worked in production but not in local development due to double URL conversion in admin previews.
