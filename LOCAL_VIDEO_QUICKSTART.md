# Local Video Storage - Quick Start (3 Minutes)

Get the Video Generator working with local storage **right now**.

## Prerequisites

✅ You have SuperAdmin access
✅ Supabase project is configured
✅ `.env.video` has ElevenLabs API key

## Step 1: Deploy Database (1 min)

```bash
supabase db push
```

Or apply the migration SQL in Supabase manually. That's it - no storage bucket needed!

## Step 2: Start Services (1 min)

**Open 2 terminal windows:**

**Terminal 1 - Video Server** (serves files):
```bash
npm run video-server
```

You should see:
```
🎬 Video Server Started
📍 URL: http://localhost:3001
📁 Videos directory: C:\Users\Administrator\Desktop\Video
```

**Terminal 2 - Video Worker** (generates videos):
```bash
npm run video-worker
```

You should see:
```
🎬 Video Generation Worker Started
⏱️  Polling interval: 5000ms
🔄 Max concurrent: 1
```

## Step 3: Test (1 min)

**Terminal 3 - Run App**:
```bash
npm run dev
```

Go to: `http://localhost:8080/superadmin/video-generator`

Click **"Create Video"** and fill in:
- Template: `Tutorial`
- Title: `My First Video`
- Script: `Hello world! This is my first AI generated video with local storage.`
- Voice: Any voice

Click **"Create Video"**

## Watch the Magic ✨

1. Video appears with "Pending" status
2. Worker processes it (check Terminal 2 logs)
3. Status changes: Generating Audio → Rendering → Completed
4. Click **Preview** to watch it
5. Click **Download** to save MP4

That's it! Your video is in: `C:\Users\Administrator\Desktop\Video\`

## Troubleshooting (30 seconds)

### Server error on port 3001?
```bash
# Maybe port 3001 is in use
# Kill the process or change port in video-generator/server.js
```

### Worker not processing?
Check Terminal 2 for errors:
```
❌ Error generating video: ...
```

Usually means ElevenLabs API key is wrong in `.env.video`

### Can't see the video?
1. Check Terminal 1 is running (video server)
2. Check `C:\Users\Administrator\Desktop\Video\` folder exists
3. Try refreshing the browser

## What's Running?

| Terminal | Service | Purpose | Port |
|----------|---------|---------|------|
| 1 | Video Server | Serves video files | 3001 |
| 2 | Video Worker | Generates videos | - |
| 3 | Dev App | React UI | 8080 |

**Keep Terminals 1 & 2 running!**

## Key Points

- 📁 Videos save to: `C:\Users\Administrator\Desktop\Video`
- 🎥 Served from: `http://localhost:3001`
- 💾 No Supabase Storage needed
- 🔄 Database tracks everything in Supabase
- 🎬 Remotion renders videos
- 🎙️ ElevenLabs generates voiceover

## Next Steps

- Read `LOCAL_VIDEO_SETUP.md` for full documentation
- Use PM2 for automatic restarts: `npm install -g pm2`
- Archive old videos to save disk space
- Create amazing marketing videos! 🚀

## Quick Commands

```bash
# View all videos
curl http://localhost:3001/videos

# List videos in folder
dir C:\Users\Administrator\Desktop\Video

# Delete all videos
del C:\Users\Administrator\Desktop\Video\*.mp4

# Stop services
# Press Ctrl+C in each terminal
```

Ready? Start with Step 1! 🎯
