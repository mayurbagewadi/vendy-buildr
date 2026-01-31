# Video Generator Setup Guide

This guide explains how to set up and use the Video Generator feature in Vendy-Buildr's SuperAdmin panel.

## Overview

The Video Generator allows SuperAdmins to create marketing videos with AI voiceover using:
- **Remotion**: For video rendering and animation
- **ElevenLabs**: For AI-generated voiceover
- **Supabase**: For storage and database

## Prerequisites

1. **Remotion** and **ElevenLabs** packages are already installed
2. **Supabase project** is set up and running
3. **Environment variables** are configured

## Setup Steps

### 1. Configure Environment Variables

Add the following to your `.env.video` file:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

Get these from:
- **SUPABASE_URL & SERVICE KEY**: Supabase Dashboard → Settings → API
- **ELEVENLABS_API_KEY**: ElevenLabs Console → API Keys

### 2. Create Supabase Storage Bucket

In Supabase Dashboard:

1. Go to **Storage** → **Buckets**
2. Click **New Bucket**
3. Name: `video-generations`
4. Make it **Private** (access controlled by policies)
5. Click **Create Bucket**

### 3. Set Storage Policies

In Supabase, add the following RLS policies to the `video-generations` bucket:

**Policy 1: SuperAdmin upload**
```sql
CREATE POLICY "superadmin_upload_videos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'video-generations'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);
```

**Policy 2: Public download (completed videos)**
```sql
CREATE POLICY "public_download_videos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'video-generations');
```

### 4. Run Database Migration

The migration is automatically applied when you deploy. It creates the `video_generations` table with:
- `id` (UUID): Unique identifier
- `title`: Video title
- `script`: Video script/content
- `template`: Type (tutorial, presentation, demo)
- `voice_id`: ElevenLabs voice ID
- `status`: Current status (pending, generating_audio, rendering, completed, failed)
- `progress`: Progress percentage (0-100)
- `video_url`: URL to stored video
- `audio_url`: URL to generated audio
- `file_size_mb`: Video file size
- `duration_seconds`: Video duration
- `error_message`: Error details if failed
- `created_by`: Creator user ID
- `created_at`: Creation timestamp
- `completed_at`: Completion timestamp

## Running the Video Generator

### Option 1: Manual Generation (CLI)

```bash
# Generate a video directly (test purpose only)
node video-generator/generate-direct.js tutorial "My Title" "My script text..."
```

### Option 2: Automated Processing (Recommended)

Start the background worker to automatically process pending videos:

```bash
# Start the worker (runs continuously)
npm run video-worker

# Or in the background
nohup npm run video-worker > video-worker.log 2>&1 &
```

The worker will:
1. Poll the database every 5 seconds for pending videos
2. Generate voiceover using ElevenLabs
3. Render video using Remotion
4. Upload to Supabase Storage
5. Update status in real-time
6. Track progress (0-100%)

### Using the UI

1. **Navigate to Video Generator**
   - Go to SuperAdmin Panel → Video Generator
   - URL: `/superadmin/video-generator`

2. **Create a Video**
   - Click "Create Video" button
   - Fill in: Title, Script, Template, Voice
   - Click "Create Video"

3. **Monitor Progress**
   - Videos appear in the grid with real-time status
   - Progress bar shows rendering progress
   - Status badges indicate: Pending, Generating, Rendering, Completed, or Failed

4. **Download Videos**
   - Click "Preview" to watch the video
   - Click "Download" to save MP4 file to your computer

5. **Manage Videos**
   - Delete videos with the delete button
   - Videos are removed from storage and database

## Architecture

### Components

- **VideoGenerator.tsx**: Main page with stats and video list
- **VideoGeneratorForm.tsx**: Form to create new videos
- **VideoList.tsx**: Real-time grid of all videos
- **VideoCard.tsx**: Individual video card with preview/download
- **VideoPreviewModal.tsx**: Video player modal

### Services

- **videoGenerator.ts**: Database operations (CRUD)
- **useVideoGeneration.ts**: React hook for state management

### Background Processing

- **worker.js**: Polls database and processes pending videos
  - Generates audio via ElevenLabs API
  - Renders video via Remotion
  - Uploads to Supabase Storage
  - Updates progress in real-time

## Monitoring

### Check Worker Status

```bash
# View worker logs
tail -f video-worker.log

# Check running processes
ps aux | grep "npm run video-worker"

# Kill worker (graceful shutdown)
pkill -f "npm run video-worker"
```

### Database Queries

View pending videos in Supabase SQL Editor:

```sql
SELECT id, title, status, progress, created_at
FROM video_generations
WHERE status != 'completed'
ORDER BY created_at DESC;
```

View completed videos:

```sql
SELECT id, title, duration_seconds, file_size_mb, completed_at
FROM video_generations
WHERE status = 'completed'
ORDER BY completed_at DESC;
```

## Troubleshooting

### Videos Stuck in "Generating" Status

**Cause**: Worker crashed or wasn't started

**Solution**:
```bash
# Restart the worker
npm run video-worker

# Or run in a process manager like PM2
npm install -g pm2
pm2 start npm --name video-worker -- run video-worker
pm2 save
pm2 startup
```

### ElevenLabs API Errors

**Cause**: Invalid API key or rate limit reached

**Check**:
- Verify `ELEVENLABS_API_KEY` in `.env.video`
- Check ElevenLabs API usage/quotas
- Ensure API key has text-to-speech permissions

### Remotion Rendering Fails

**Cause**: Missing audio file, invalid template, or system resource issues

**Check**:
- Ensure audio is generated successfully
- Verify template files exist: `video-generator/templates/`
- Check available disk space and RAM (Remotion can use 2-4GB)

### Storage Upload Fails

**Cause**: Bucket doesn't exist or policies not set correctly

**Solution**:
1. Verify bucket `video-generations` exists in Supabase Storage
2. Check bucket policies allow uploads
3. Verify `SUPABASE_SERVICE_KEY` has correct permissions

## Performance Optimization

- **Parallel Processing**: Currently processes 1 video at a time. To process multiple:
  - Change `MAX_CONCURRENT` in `worker.js`
  - Ensure server has enough resources (4GB+ RAM per concurrent render)

- **Timeout Settings**: Edit in `worker.js`:
  - Rendering timeout: 30 minutes (adjustable)
  - Polling interval: 5 seconds (adjustable)

- **Video Quality**: Edit in template files:
  - `video-generator/templates/TutorialVideo.jsx`
  - `video-generator/templates/PresentationVideo.jsx`
  - `video-generator/templates/DemoVideo.jsx`

## API Reference

### Creating a Video Programmatically

```typescript
import { createVideoGeneration } from '@/lib/videoGenerator';

const video = await createVideoGeneration({
  title: 'My Marketing Video',
  script: 'Hello world! This is my video...',
  template: 'tutorial',
  voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel
});

// Status updates in real-time via Supabase subscriptions
```

### Real-time Updates

The UI automatically receives updates via Supabase real-time subscriptions. You can also subscribe manually:

```typescript
const subscription = supabase
  .channel('video_generations_changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'video_generations',
    },
    (payload) => {
      console.log('Video updated:', payload.new);
    }
  )
  .subscribe();
```

## Voice Options

Available ElevenLabs voices (sample IDs):

- **Rachel** (default): `21m00Tcm4TlvDq8ikWAM`
- **Antoni**: `nPczCjzI2devNBz1zQrb`
- **Elli**: `rJ8jqrWETLw2QY8z5iHm`
- **Josh**: `TX3LPaxmHKzATmzU5KHW`

To add more voices, update voice options in `VideoGeneratorForm.tsx`.

## Costs

- **ElevenLabs**: ~$0.30 per 1,000 characters
- **Remotion**: Free (open-source)
- **Supabase Storage**: ~$0.023 per GB (included in free tier for small usage)

Monitor API usage in respective dashboards to manage costs.

## Next Steps

1. Deploy database migration
2. Create storage bucket
3. Configure environment variables
4. Start the background worker
5. Access Video Generator from SuperAdmin panel
6. Create your first video!

For more information:
- [Remotion Docs](https://www.remotion.dev/docs)
- [ElevenLabs Docs](https://elevenlabs.io/docs)
- [Supabase Docs](https://supabase.com/docs)
