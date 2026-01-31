# Video Generator - Complete Setup Guide (Local Storage)

## 🎯 What You're Getting

A **Video Generator** for the SuperAdmin panel that:
- ✅ Creates marketing videos with AI voiceover
- ✅ Stores videos locally (not in cloud)
- ✅ Serves videos via local API
- ✅ Shows real-time progress
- ✅ Allows preview and download
- ✅ Integrates with SuperAdmin dashboard

---

## 📋 Before You Start

Make sure you have:
- ✅ Node.js installed (v16+)
- ✅ Supabase project set up
- ✅ `.env.video` file with ElevenLabs API key
- ✅ About 10GB free disk space for videos

---

## 🚀 Quick Start (Follow These Exactly)

### Step 1: Deploy Database Migration (1 minute)

```bash
cd C:/Users/Administrator/Desktop/vendy-buildr
supabase db push
```

Or manually apply the SQL from:
```
supabase/migrations/20260128120000_e1b2c3d4-e5f6-4g7h-8i9j-0k1l2m3n4o5p.sql
```

### Step 2: Open 3 Terminal Windows

Keep all 3 running during development.

#### Terminal 1 - Video Server (Port 3001)

```bash
cd C:/Users/Administrator/Desktop/vendy-buildr
npm run video-server
```

Expected output:
```
🎬 Video Server Started
📍 URL: http://localhost:3001
📁 Videos directory: C:\Users\Administrator\Desktop\Video
```

This serves videos from the local folder.

#### Terminal 2 - Video Worker (Background)

```bash
cd C:/Users/Administrator/Desktop/vendy-buildr
npm run video-worker
```

Expected output:
```
🎬 Video Generation Worker Started
⏱️  Polling interval: 5000ms
🔄 Max concurrent: 1
```

This generates videos in the background.

#### Terminal 3 - Dev App (Port 8080)

```bash
cd C:/Users/Administrator/Desktop/vendy-buildr
npm run dev
```

Open your browser to: `http://localhost:8080`

### Step 3: Go to Video Generator

1. Log in as SuperAdmin
2. Click "SuperAdmin" in the menu
3. Find "Video Generator" in the sidebar
4. Or go directly to: `http://localhost:8080/superadmin/video-generator`

### Step 4: Create Your First Video

1. Click **"Create Video"** button
2. Fill in the form:
   - **Template**: Select "Tutorial"
   - **Title**: "Welcome to Vendy"
   - **Script**: "Hello! Welcome to Vendy Buildr. This is my first AI video."
   - **Voice**: Select "Rachel" (or any voice)
3. Click **"Create Video"**

### Step 5: Watch It Generate

1. Video appears with "Pending" status
2. Check Terminal 2 logs - you'll see progress:
   ```
   📺 Processing video: Welcome to Vendy (uuid)
   🎙️  Generating voiceover...
   ✅ Voiceover generated...
   🎨 Rendering video...
   ☁️  Uploading to storage...
   ✅ Video stored locally: C:\Users\Administrator\Desktop\Video\uuid.mp4
   ✅ Video completed: Welcome to Vendy
   ```
3. Back in the UI, status changes to "Completed"
4. Click **"Preview"** to watch your video
5. Click **"Download"** to save the MP4

---

## 📁 File Locations

```
C:\Users\Administrator\Desktop\vendy-buildr\
├── video-generator/
│   ├── server.js              ← Express API (NEW)
│   ├── worker.js              ← Modified for local storage
│   ├── templates/             ← Video templates
│   └── output/                ← Temp renders
├── src/
│   ├── pages/superadmin/
│   │   └── VideoGenerator.tsx
│   ├── components/superadmin/
│   │   ├── VideoGeneratorForm.tsx
│   │   ├── VideoList.tsx
│   │   ├── VideoCard.tsx
│   │   └── VideoPreviewModal.tsx
│   └── lib/
│       └── videoGenerator.ts  ← Modified for local API
├── LOCAL_VIDEO_SETUP.md       ← Full setup guide
├── LOCAL_VIDEO_QUICKSTART.md  ← Quick start (3 min)
├── LOCAL_STORAGE_SUMMARY.md   ← What changed
└── ...

C:\Users\Administrator\Desktop\Video\        ← Videos stored here
├── 550e8400-e29b-41d4-a716-446655440000.mp4
├── 6ba7b810-9dad-11d1-80b4-00c04fd430c8.mp4
└── ...
```

---

## 🎯 Key Points

### Three Services Must Run

| Terminal | Service | Purpose | Port |
|----------|---------|---------|------|
| 1 | Video Server | Serves video files | 3001 |
| 2 | Video Worker | Generates videos | - |
| 3 | Dev App | React UI | 8080 |

**IMPORTANT**: Keep Terminals 1 & 2 running at all times!

### Data Flow

```
User Creates Video (UI)
    ↓
Supabase DB (video_generations table)
    ↓
Worker Polls DB (every 5 seconds)
    ↓
Remotion Renders Video
    ↓
Copy to C:\Users\Administrator\Desktop\Video\
    ↓
Express Server Serves File
    ↓
UI Shows "Completed"
    ↓
User Previews/Downloads
```

### Video URLs

```
Database: http://localhost:3001/video/550e8400-e29b-41d4-a716-446655440000
Preview:  http://localhost:3001/video/550e8400-e29b-41d4-a716-446655440000
Download: http://localhost:3001/download/550e8400-e29b-41d4-a716-446655440000
```

---

## 🔧 Common Tasks

### Check if Services are Running

```bash
# Video Server
curl http://localhost:3001/health

# Worker logs
# Check Terminal 2 output for messages
```

### List All Videos

```bash
# In browser
http://localhost:3001/videos

# Or curl
curl http://localhost:3001/videos

# Or file explorer
explorer C:\Users\Administrator\Desktop\Video
```

### Stop Services

Press **Ctrl+C** in each terminal.

### Restart Services

Press **Ctrl+C**, then run the command again.

### Delete a Video

Option 1: Use UI (click delete button)
Option 2: Use API:
```bash
curl -X DELETE http://localhost:3001/video/550e8400-e29b-41d4-a716-446655440000
```

---

## ⚙️ Configuration

### Change Storage Folder

Edit `video-generator/server.js` line 13:

```javascript
const VIDEOS_DIR = 'C:\\Users\\Administrator\\Desktop\\Video';
```

Change to your desired path, then restart server.

### Change Server Port

Edit `video-generator/server.js` line 12:

```javascript
const PORT = 3001;
```

Then update `src/lib/videoGenerator.ts` to match the new port in URLs.

### Change Worker Polling Interval

Edit `video-generator/worker.js` line 51:

```javascript
const POLL_INTERVAL = 5000;  // milliseconds
```

5000ms = 5 seconds. Change as needed.

---

## 🐛 Troubleshooting

### "Cannot connect to http://localhost:3001"

**Problem**: Video server not running
**Solution**: Start Terminal 1
```bash
npm run video-server
```

### "Videos stuck in Pending status"

**Problem**: Worker not running
**Solution**: Start Terminal 2
```bash
npm run video-worker
```

### "ElevenLabs API error"

**Problem**: Invalid API key
**Solution**:
1. Check `.env.video` has valid API key
2. Verify at https://elevenlabs.io/app/api-keys
3. Make sure API key has text-to-speech permissions

### "Rendering failed"

**Problem**: Remotion error or missing audio
**Solution**:
1. Check Terminal 2 logs for error
2. Try shorter script (less than 500 characters)
3. Ensure ElevenLabs API key is valid

### "Videos folder doesn't exist"

**Problem**: Permission denied
**Solution**:
1. Folder is auto-created with correct permissions
2. If error persists, manually create:
   ```bash
   mkdir C:\Users\Administrator\Desktop\Video
   ```

### "Port 3001 already in use"

**Problem**: Another app using port 3001
**Solution**:
1. Change port in `video-generator/server.js`
2. Update URLs in `src/lib/videoGenerator.ts`
3. Restart server

### "Downloaded file won't play"

**Problem**: Video still rendering
**Solution**:
1. Wait for status to show "Completed"
2. Check Terminal 2 for errors
3. Try again after video fully generated

---

## 📊 Monitoring

### Check Database Status

```sql
SELECT
  status,
  COUNT(*) as count
FROM video_generations
GROUP BY status;

-- Result shows: pending, generating_audio, rendering, completed, failed
```

### Check Disk Space

```bash
# Windows PowerShell
$videos = Get-ChildItem -Path 'C:\Users\Administrator\Desktop\Video' -ErrorAction SilentlyContinue
$size = ($videos | Measure-Object -Property Length -Sum).Sum / 1GB
Write-Host "Total: $($size.ToString('F2')) GB"
```

### View Logs

**Server logs**: Terminal 1 output
**Worker logs**: Terminal 2 output

Example log entries:
```
▶️  Streaming video: 550e8400.mp4 (45.23 MB)
📺 Processing video: My Video (550e8400-...)
✅ Voiceover generated: path/to/audio.mp3
🎨 Rendering video...
✅ Video stored locally: C:\Users\Administrator\Desktop\Video\550e8400.mp4
```

---

## 🎮 UI Features

### Create Video
- Click "Create Video" button
- Form validates: title, script, template, voice
- Submit creates database record
- Worker picks it up automatically

### Monitor Progress
- Real-time status: Pending → Generating → Rendering → Completed
- Progress bar shows 0-100%
- Error message if something fails

### Preview Video
- Only available when status = "Completed"
- Click "Preview" button
- HTML5 video player with full controls

### Download Video
- Only available when status = "Completed"
- Click "Download" button
- Saves as: `{videoId}.mp4` to Downloads

### Delete Video
- Available for all statuses
- Click delete icon
- Confirmation dialog
- Removes file from storage + database record

---

## 📈 Scalability

### Single Video (Default)
- Max 1 video processing at a time
- Safe for development

### Multiple Videos (If You Need)
Edit `video-generator/worker.js`:
```javascript
const MAX_CONCURRENT = 1;  // Change to 2 or 3
```

Requirements for parallel:
- Multiple CPU cores
- 2-4GB RAM per concurrent render
- Fast disk (SSD preferred)

---

## 🛡️ Security

### Database
- RLS policies protect access
- SuperAdmin-only access
- Database is private Supabase

### Files
- Local folder (full control)
- Express server validates input
- No file traversal possible

### API
- Localhost only (development)
- Simple auth (SuperAdmin role via DB)
- No sensitive data exposed

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| `LOCAL_VIDEO_QUICKSTART.md` | 3-minute quick start |
| `LOCAL_VIDEO_SETUP.md` | Complete setup & configuration |
| `LOCAL_STORAGE_SUMMARY.md` | What changed from cloud to local |
| `FINAL_SETUP_GUIDE.md` | This file |

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Terminal 1: `npm run video-server` - starts without errors
- [ ] Terminal 2: `npm run video-worker` - starts without errors
- [ ] Terminal 3: `npm run dev` - app loads on localhost:8080
- [ ] http://localhost:3001/health - returns OK
- [ ] http://localhost:3001/videos - returns empty JSON array
- [ ] Can access `/superadmin/video-generator` (with SuperAdmin account)
- [ ] Can click "Create Video" and form opens
- [ ] Can fill form and submit (no validation errors)
- [ ] Video appears in list with "Pending" status
- [ ] Terminal 2 shows "Processing video" message
- [ ] Status changes to "Completed" after 1-3 minutes
- [ ] File exists in `C:\Users\Administrator\Desktop\Video\`
- [ ] Can click "Preview" and video plays
- [ ] Can click "Download" and file saves
- [ ] Can click "Delete" and video removed

---

## 🎬 Ready to Start?

1. ✅ Open 3 terminals
2. ✅ Run the 3 commands above
3. ✅ Go to video generator UI
4. ✅ Create your first video
5. ✅ Watch the magic happen! ✨

---

## 🆘 Still Having Issues?

1. **Check Terminal Output**: Look for error messages
2. **Read `LOCAL_VIDEO_SETUP.md`**: Full documentation
3. **Check Database**: Verify video_generations table exists
4. **Verify Paths**: Ensure `C:\Users\Administrator\Desktop\Video` is accessible
5. **Restart Everything**: Stop all terminals, start fresh

---

## 📞 Key Commands Reference

```bash
# Setup
supabase db push

# Start services
npm run video-server    # Terminal 1
npm run video-worker    # Terminal 2
npm run dev             # Terminal 3

# API calls
curl http://localhost:3001/health                    # Check server
curl http://localhost:3001/videos                    # List videos
curl -X DELETE http://localhost:3001/video/{id}     # Delete video

# View videos
explorer C:\Users\Administrator\Desktop\Video

# Stop services (in each terminal)
Ctrl+C
```

---

## 🎉 You're All Set!

Everything is ready to go. Just follow the Quick Start steps above and start creating amazing marketing videos!

**Questions?** Check the docs:
- 3-min quick start: `LOCAL_VIDEO_QUICKSTART.md`
- Full setup: `LOCAL_VIDEO_SETUP.md`
- What changed: `LOCAL_STORAGE_SUMMARY.md`

Happy video creation! 🚀
