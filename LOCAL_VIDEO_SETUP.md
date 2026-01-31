# Local Video Storage Setup Guide

This guide explains how to set up the Video Generator to store videos **locally** instead of using cloud storage.

## Overview

Videos are:
- 📁 **Stored locally** in: `C:\Users\Administrator\Desktop\Video`
- 🎥 **Served via API** at: `http://localhost:3001`
- 💾 **No cloud uploads** - all files stay on your computer

## Quick Start (3 Steps)

### Step 1: Create Videos Directory

The directory is created automatically, but you can create it manually:

```bash
# Windows Command Prompt
mkdir C:\Users\Administrator\Desktop\Video

# Or just let the system create it automatically
```

### Step 2: Start Two Services (Terminal 1 & 2)

**Terminal 1 - Video Server** (for serving videos):
```bash
npm run video-server
```

Output should show:
```
🎬 Video Server Started
📍 URL: http://localhost:3001
📁 Videos directory: C:\Users\Administrator\Desktop\Video

Available endpoints:
  GET  /health              - Health check
  GET  /video/:videoId      - Stream video
  GET  /download/:videoId   - Download video
  GET  /videos              - List all videos
  DELETE /video/:videoId    - Delete video
```

**Terminal 2 - Background Worker** (for generating videos):
```bash
npm run video-worker
```

Output should show:
```
🎬 Video Generation Worker Started
⏱️  Polling interval: 5000ms
🔄 Max concurrent: 1
```

### Step 3: Start Your App (Terminal 3)

```bash
npm run dev
```

Now navigate to: `http://localhost:8080/superadmin/video-generator`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React UI (Port 8080)                  │
│              VideoGenerator → VideoGeneratorForm            │
└────────────────────┬────────────────────────────────────────┘
                     │ Insert video_generations
                     ↓
         ┌───────────────────────┐
         │   Supabase Database   │
         │  (video_generations)  │
         └───────────┬───────────┘
                     │ Poll status
                     ↓
    ┌────────────────────────────────┐
    │  Worker (Port None - Background)│
    │  - Generate Voiceover (ElevenLabs)
    │  - Render Video (Remotion)
    │  - Save to local folder
    └────────────────┬───────────────┘
                     │ Update DB
                     ↓
    ┌────────────────────────────────────────┐
    │   Express Server (Port 3001)            │
    │   C:\Users\Administrator\Desktop\Video │
    │   - Stream videos: /video/:id           │
    │   - Download: /download/:id             │
    │   - List: /videos                       │
    │   - Delete: DELETE /video/:id           │
    └────────────────────────────────────────┘
         ↑
         │ Preview/Download
         │
    React UI
```

## File Structure

```
C:\Users\Administrator\Desktop\Video\
├── 550e8400-e29b-41d4-a716-446655440000.mp4    # Video 1
├── 6ba7b810-9dad-11d1-80b4-00c04fd430c8.mp4    # Video 2
└── ...
```

Each file is named with the video's UUID from the database.

## Running the Services

### Three Terminals Setup

```bash
# Terminal 1: Video Server (always needs to run)
npm run video-server

# Terminal 2: Video Worker (always needs to run)
npm run video-worker

# Terminal 3: Development App
npm run dev
```

Keep both Terminal 1 & 2 running continuously!

### Using Process Manager (PM2 - Recommended for Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start services with PM2
pm2 start npm --name "video-server" -- run video-server
pm2 start npm --name "video-worker" -- run video-worker

# Check status
pm2 status

# View logs
pm2 logs video-server
pm2 logs video-worker

# Stop services
pm2 stop video-server video-worker

# Save to startup
pm2 startup
pm2 save
```

### Using Windows Task Scheduler (Advanced)

See bottom of this guide for detailed instructions.

## API Endpoints

### Health Check
```bash
curl http://localhost:3001/health
```

Response:
```json
{ "status": "ok", "timestamp": "2026-01-28T12:00:00.000Z" }
```

### Stream Video (for preview in UI)
```bash
# Browser/Video Player
http://localhost:3001/video/550e8400-e29b-41d4-a716-446655440000
```

### Download Video
```bash
# Browser
http://localhost:3001/download/550e8400-e29b-41d4-a716-446655440000
```

### List All Videos
```bash
curl http://localhost:3001/videos
```

Response:
```json
{
  "videos": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "filename": "550e8400-e29b-41d4-a716-446655440000.mp4",
      "size": 52428800,
      "sizeM": "50.00",
      "created": "2026-01-28T10:30:00.000Z",
      "modified": "2026-01-28T10:35:00.000Z"
    }
  ]
}
```

### Delete Video
```bash
curl -X DELETE http://localhost:3001/video/550e8400-e29b-41d4-a716-446655440000
```

## Configuration

### Change Videos Directory

Edit `video-generator/server.js` line 14:

```javascript
// Change this path:
const VIDEOS_DIR = 'C:\\Users\\Administrator\\Desktop\\Video';

// To your preferred location:
const VIDEOS_DIR = 'D:\\MyVideos';
```

### Change Server Port

Edit `video-generator/server.js` line 13:

```javascript
// Change this:
const PORT = 3001;

// To:
const PORT = 8888;
```

Then update `src/lib/videoGenerator.ts` to match:

```typescript
export function getLocalVideoUrl(videoId: string): string {
  return `http://localhost:8888/video/${videoId}`;  // Change port
}
```

## Troubleshooting

### "Videos Folder Already Exists"
This is fine! The system will just use the existing folder.

### "Connection Refused: http://localhost:3001"
**Cause**: Video server not running

**Solution**:
```bash
npm run video-server
```

### "Worker Not Processing Videos"
**Cause**: Worker not running

**Solution**:
```bash
npm run video-worker
```

Check the logs for errors.

### "Video Stuck in Pending"
**Cause**: Worker or server crashed

**Solution**:
1. Press Ctrl+C on both servers
2. Restart them:
```bash
npm run video-server
npm run video-worker
```

### "Video Player Shows Blank"
**Cause**: Server running but video file missing

**Solution**:
1. Check if file exists: `C:\Users\Administrator\Desktop\Video\{videoId}.mp4`
2. Check worker logs for rendering errors
3. Verify ElevenLabs API key in `.env.video`

### "Downloaded File Won't Play"
**Cause**: Video still rendering

**Solution**:
- Wait for status to change to "Completed"
- Check worker logs: `npm run video-worker` output

### "Cannot Create Videos Folder"
**Cause**: Permission denied

**Solution**:
1. Right-click `C:\Users\Administrator\Desktop`
2. Properties → Security → Edit
3. Select your user → Full Control → OK
4. Restart the terminal and try again

## Storage Management

### Check Disk Space Used

```bash
# Windows PowerShell
(Get-ChildItem -Path 'C:\Users\Administrator\Desktop\Video' | Measure-Object -Property Length -Sum).Sum / 1MB
```

### Delete All Videos

```bash
# WARNING: This deletes all video files
# Windows Command Prompt
del C:\Users\Administrator\Desktop\Video\*.mp4
```

Or use the UI: Click delete on each video card.

### Archive Old Videos

```bash
# Move videos older than 30 days to archive
# Windows Command Prompt
forfiles /S /D +30 /C "cmd /c move @path D:\VideoArchive\"
```

## Development vs Production

### Development Setup (Recommended for Testing)

```bash
# Simple setup - everything on localhost
npm run video-server   # Terminal 1
npm run video-worker   # Terminal 2
npm run dev            # Terminal 3

# Videos: C:\Users\Administrator\Desktop\Video
# Server: http://localhost:3001
# App: http://localhost:8080
```

### Production Setup (Using PM2)

```bash
# Install PM2
npm install -g pm2

# Start services
pm2 start npm --name "video-server" -- run video-server
pm2 start npm --name "video-worker" -- run video-worker

# Verify they're running
pm2 status

# Make them start on boot
pm2 startup
pm2 save
```

### Production Setup (Using Task Scheduler)

See bottom of this guide for detailed Windows Task Scheduler setup.

## Performance

### Server Performance

- **Max concurrent connections**: Limited by system resources
- **Default memory usage**: ~50-100MB per service
- **Video streaming**: Supports range requests (seeking in video)
- **Bandwidth**: Limited by disk read speed (~100-500 MB/s)

### Optimization Tips

1. **Use SSD** for video storage (faster than HDD)
2. **Monitor disk space** regularly
3. **Archive old videos** to external storage
4. **Use PM2** in production for automatic restarts
5. **Monitor worker logs** for errors

## Windows Task Scheduler Setup (Advanced)

For automatic startup on system reboot:

### 1. Create Batch Files

**C:\Users\Administrator\Desktop\vendy-buildr\start-video-server.bat**:
```batch
@echo off
cd C:\Users\Administrator\Desktop\vendy-buildr
npm run video-server
pause
```

**C:\Users\Administrator\Desktop\vendy-buildr\start-video-worker.bat**:
```batch
@echo off
cd C:\Users\Administrator\Desktop\vendy-buildr
npm run video-worker
pause
```

### 2. Open Task Scheduler

1. Windows + R → `taskschd.msc` → Enter
2. Click "Create Basic Task..." on right panel

### 3. Create Task for Video Server

1. **Name**: "Vendy Video Server"
2. **Trigger**: "At startup"
3. **Action**:
   - Program: `C:\Users\Administrator\Desktop\vendy-buildr\start-video-server.bat`
   - Start in: `C:\Users\Administrator\Desktop\vendy-buildr`
4. **Finish**

### 4. Create Task for Video Worker

1. **Name**: "Vendy Video Worker"
2. **Trigger**: "At startup" (but delay by 1 minute)
3. **Action**:
   - Program: `C:\Users\Administrator\Desktop\vendy-buildr\start-video-worker.bat`
   - Start in: `C:\Users\Administrator\Desktop\vendy-buildr`
4. **Finish**

## Monitoring

### Check Server Status

```bash
curl http://localhost:3001/health
```

### Check Running Processes

```bash
# Windows PowerShell
Get-Process node

# Or with PM2
pm2 status
```

### View Logs

```bash
# Server logs (if running in Terminal 1)
# Check output in Terminal 1 window

# Worker logs (if running in Terminal 2)
# Check output in Terminal 2 window

# Or with PM2
pm2 logs video-server
pm2 logs video-worker
```

## Next Steps

1. ✅ Create `C:\Users\Administrator\Desktop\Video` directory
2. ✅ Start video server: `npm run video-server`
3. ✅ Start video worker: `npm run video-worker`
4. ✅ Start app: `npm run dev`
5. ✅ Create your first video!
6. ✅ Check `C:\Users\Administrator\Desktop\Video\` for video files
7. ✅ Preview and download videos from UI

## Frequently Asked Questions

**Q: Can I move the video folder?**
A: Yes, edit `VIDEOS_DIR` in `video-generator/server.js` and restart the server.

**Q: How much disk space do I need?**
A: At least 10GB recommended. Each 1-minute video is ~15-50MB.

**Q: Can I run on different ports?**
A: Yes, edit `PORT` in `video-generator/server.js` and update the React code.

**Q: Will videos persist after restart?**
A: Yes! They're stored in the local folder. The database records persist in Supabase.

**Q: Can I serve videos over the internet?**
A: Not with this setup (localhost only). For that, use Supabase Storage or S3.

## Summary

With local storage:
- ✅ No cloud costs
- ✅ Fast preview and download (no network latency)
- ✅ Videos stay on your computer
- ✅ Simple setup and maintenance
- ❌ Only accessible from localhost
- ❌ Requires manual disk management

Ready to create videos locally! 🎬
