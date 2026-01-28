# Quick Start Guide

## 5-Minute Setup

### Step 1: Get API Key (2 minutes)
```
1. Go to https://elevenlabs.io
2. Sign up (free account)
3. Copy your API key from dashboard
4. Paste into .env.video file:
   ELEVENLABS_API_KEY=your_key_here
```

### Step 2: Generate Your First Video (3 minutes)
```bash
npm run generate-video
```

Answer the prompts:
- Choose video type (1, 2, or 3)
- Enter title
- Paste script from EXAMPLES.md or write your own

**That's it!** Your video will be in `video-generator/output/`

---

## Video Types Quick Reference

| Type | Use Case | Tone |
|------|----------|------|
| **1. Tutorial** | How-to guides | Professional, step-by-step |
| **2. Presentation** | Feature showcase | Engaging, inspiring |
| **3. Demo** | Product walkthrough | Clean, professional |

---

## Example: Generate a Tutorial Video

```
$ npm run generate-video

Select video type:
1. Tutorial Video (How-to guides)
2. Animated Presentation (Feature showcase)
3. Product Demo (Live demonstration)

Enter choice (1-3): 1

Video title: How to Setup Your First Store

Video script: Welcome to Vendy-Buildr. In this tutorial we'll show you how to setup your first store in just 3 steps...

🎙️  Generating voiceover...
✅ Voiceover saved
🎨 Rendering video...
✅ Video generated successfully!
📁 Output: video-generator/output/tutorial-1726481234.mp4
```

---

## Next Steps

1. **Find your video** in `video-generator/output/`
2. **Download to computer**
3. **Upload to social media**:
   - Instagram
   - YouTube
   - TikTok
   - Facebook
   - LinkedIn

---

## Troubleshooting

**Issue**: "API key not configured"
- Check `.env.video` has your ElevenLabs API key

**Issue**: Video rendering takes too long
- This is normal (5-15 min depending on system)
- Be patient, let it finish

**Issue**: No audio in video
- Check API key is valid
- Check script isn't too long (max ~500 words)

---

## Need More Help?

- **README.md** - Full documentation
- **EXAMPLES.md** - Sample scripts for different video types
- **templates/** - Edit video design/colors

---

## Need More Voices?

Edit `.env.video` and change `ELEVENLABS_VOICE_ID`:

```
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Rachel (Default)
ELEVENLABS_VOICE_ID=ErXwobaYiN019PkySvjV  # Antoni
ELEVENLABS_VOICE_ID=MF3mGyEYCl7XYWbV9V6O  # Elli
ELEVENLABS_VOICE_ID=TxGEqnHWrfWFTfGW9XjX  # Josh
```

Find more at: https://elevenlabs.io/voice-lab

---

Happy creating! 🎬

Questions? Check README.md or EXAMPLES.md
