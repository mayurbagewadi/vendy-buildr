# Video Generator - Quick Start Guide

Get the Video Generator feature up and running in 5 minutes.

## Prerequisites

- ✅ You have SuperAdmin access
- ✅ Supabase project is set up
- ✅ `.env.video` file exists (check `.env.video` in project root)

## Step 1: Deploy Database Migration (1 min)

The database migration is already created. Deploy it:

```bash
cd C:/Users/Administrator/Desktop/vendy-buildr
supabase db push
```

Or if you're using manual migrations, apply this SQL in Supabase:
```sql
-- See: supabase/migrations/20260128120000_e1b2c3d4-e5f6-4g7h-8i9j-0k1l2m3n4o5p.sql
```

## Step 2: Create Storage Bucket (1 min)

In Supabase Dashboard:

1. **Storage** → **Buckets** → **New Bucket**
2. Name: `video-generations`
3. Privacy: **Private**
4. Click **Create Bucket**

That's it! Policies are automatically set in the migration.

## Step 3: Configure Environment (1 min)

Edit `.env.video` and add:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

Get these from:
- **Supabase**: Settings → API → Copy the URLs and keys
- **ElevenLabs**: https://elevenlabs.io/app/api-keys

## Step 4: Start Background Worker (1 min)

Open a terminal and run:

```bash
npm run video-worker
```

You should see:
```
🎬 Video Generation Worker Started
⏱️  Polling interval: 5000ms
🔄 Max concurrent: 1
```

Keep this running! (In production, use PM2 or Docker)

## Step 5: Test the Feature (1 min)

1. **Go to SuperAdmin Panel**
   - Navigate to: `http://localhost:8080/superadmin/dashboard`
   - Or click **Dashboard** menu

2. **Click "Video Generator"**
   - In the left sidebar menu
   - Or at `/superadmin/video-generator`

3. **Create Your First Video**
   - Click "Create Video" button
   - Fill in:
     - **Template**: Select "Tutorial"
     - **Title**: "My First Video"
     - **Script**: "Hello world! Welcome to Vendy Buildr. This is my first AI generated video."
     - **Voice**: Select any voice (e.g., "Rachel")
   - Click "Create Video"

4. **Watch the Magic Happen**
   - Video appears in list with "Pending" status
   - Worker picks it up (check terminal for logs)
   - Status changes: Generating Audio → Rendering → Completed
   - Progress bar shows 0-100%

5. **Preview Your Video**
   - When complete, click "Preview" button
   - Video player opens
   - Click "Download" to save MP4

## ⚡ Quick Troubleshooting

### "Video stuck in Pending"
```bash
# Worker not running? Start it:
npm run video-worker

# Or restart it:
# Press Ctrl+C then run again
```

### "ElevenLabs API error"
- Check `.env.video` has correct API key
- Verify API key is active at https://elevenlabs.io
- Try a shorter script (less than 500 chars)

### "Rendering failed"
- Check available disk space (need 500MB+)
- Try a shorter script
- Check Remotion is installed: `npx remotion --version`

### "Video URL not showing"
- Verify `video-generations` bucket exists in Supabase Storage
- Check bucket policies allow uploads

## 📊 Check Worker Status

In the terminal running the worker:
```
📺 Processing video: My First Video (uuid-here)
🎙️  Generating voiceover...
✅ Voiceover generated: path/to/audio.mp3
🎨 Rendering video...
🖼️  Video rendered successfully
☁️  Uploading to storage...
✅ Video uploaded: https://url/to/video.mp4
✅ Video completed: My First Video
```

## 🎯 What to Test

1. **Create videos** with different templates
2. **Use different voices** for variety
3. **Watch progress updates** in real-time
4. **Preview completed videos**
5. **Download MP4 files**
6. **Delete videos** (removes from storage too)

## 📝 Script Tips

Good script length: **100-300 characters**

Examples:
- ✅ "Hello! Welcome to our platform. We help creators build online stores." (65 chars)
- ✅ "This tutorial shows you how to set up products, manage inventory, and track sales in real-time. Let's get started!" (112 chars)
- ❌ Avoid: Very long scripts (>2000 chars) or special characters

## 🎨 Video Templates

- **Tutorial**: Educational content (how-to, tips)
- **Presentation**: Product demo or feature showcase
- **Demo**: Quick product walkthrough

Choose based on your use case!

## 🔊 Voice Selection

- Rachel (calm, professional)
- Antoni (warm, engaging)
- Elli (friendly, young)
- Josh (confident, authoritative)

## ⏱️ How Long Does It Take?

- **Voiceover**: 5-10 seconds
- **Rendering**: 30-120 seconds (depends on script length)
- **Upload**: 5-30 seconds

Total: **1-3 minutes per video**

## 🚀 Next Steps

After testing:

1. **Customize video templates** (in `video-generator/templates/`)
2. **Configure worker as service** (PM2, systemd, Docker)
3. **Set up monitoring** (logs, database queries)
4. **Add more voices** (if desired)
5. **Create content strategy** for marketing videos

## 📚 More Resources

- **Full Setup Guide**: `VIDEO_GENERATOR_SETUP.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **Source Files**:
  - Main: `src/pages/superadmin/VideoGenerator.tsx`
  - Form: `src/components/superadmin/VideoGeneratorForm.tsx`
  - Worker: `video-generator/worker.js`

## 💡 Pro Tips

1. **Parallel Processing**: Edit `worker.js` line with `MAX_CONCURRENT` to process multiple videos
2. **Silent Videos**: Leave `ELEVENLABS_API_KEY` empty to skip voiceover
3. **Monitor Worker**: Use `tail -f` to watch logs in real-time
4. **Database Monitoring**: Use Supabase SQL Editor to view `video_generations` table

## 🎬 Ready?

```bash
# Terminal 1: Start the app
npm run dev

# Terminal 2: Start the worker
npm run video-worker

# Terminal 3: Go to SuperAdmin and create videos!
# http://localhost:8080/superadmin/video-generator
```

Enjoy creating videos! 🚀
