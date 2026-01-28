# Vendy-Buildr Video Generator

Generate professional marketing videos for Vendy-Buildr platform using Remotion and ElevenLabs.

## Features

- **3 Video Templates**:
  - Tutorial Videos (How-to guides)
  - Animated Presentations (Feature showcase)
  - Product Demo Videos (Live demonstrations)

- **Professional Animations** - Smooth transitions, animated text, and dynamic elements
- **AI Voice Narration** - ElevenLabs text-to-speech integration
- **Easy CLI** - Simple command-line interface for video generation
- **High Quality Output** - 1920x1080 at 30fps, exported as MP4

## Setup

### 1. Get ElevenLabs API Key

1. Sign up at https://elevenlabs.io (free tier available)
2. Go to your dashboard and copy your API key
3. Update `.env.video` file with your API key:

```bash
ELEVENLABS_API_KEY=your_api_key_here
```

### 2. (Optional) Choose Voice

Default voice is "Rachel" (warm, professional female).

Available voices in `.env.video`:
- `21m00Tcm4TlvDq8ikWAM` - Rachel (Recommended)
- `ErXwobaYiN019PkySvjV` - Antoni (Male)
- `MF3mGyEYCl7XYWbV9V6O` - Elli (Female, emotional)
- `TxGEqnHWrfWFTfGW9XjX` - Josh (Male, deep)

Update `ELEVENLABS_VOICE_ID` in `.env.video` to change voices.

## Usage

Run the video generator:

```bash
npm run generate-video
```

Follow the interactive prompts:
1. Select video type (1-3)
2. Enter video title
3. Enter script/content

Videos are saved to `video-generator/output/`

## Example

```
$ npm run generate-video

🎬 Vendy-Buildr Video Generator

Select video type:
1. Tutorial Video (How-to guides)
2. Animated Presentation (Feature showcase)
3. Product Demo (Live demonstration)

Enter choice (1-3): 1
Video title: How to Setup Your First Store
Video script: In this tutorial, we'll walk you through setting up your first store on Vendy-Buildr...

🎙️  Generating voiceover...
✅ Voiceover saved to video-generator/assets/audio/tutorial-1726481234.mp3
🎨 Rendering video...
✅ Video generated successfully!
📁 Output: video-generator/output/tutorial-1726481234.mp4
```

## Video Templates

### Tutorial Video
- Step-by-step guide format
- Professional dark theme
- Cyan accent colors
- Progress indicators
- Branding footer

### Animated Presentation
- Feature showcase format
- Modern gradient background
- Animated background elements
- Feature highlight cards
- Statistics display

### Product Demo
- Live demo format
- Clean white theme
- Browser mockup frame
- Statistics cards
- Progress bar

## Directory Structure

```
video-generator/
├── generate.js                 # CLI entry point
├── remotion.config.ts          # Remotion configuration
├── README.md                   # This file
├── templates/
│   ├── index.jsx              # Remotion compositions
│   ├── TutorialVideo.jsx       # Tutorial template
│   ├── PresentationVideo.jsx   # Presentation template
│   └── DemoVideo.jsx           # Demo template
├── assets/
│   └── audio/                 # Generated audio files
└── output/                    # Generated videos
```

## Troubleshooting

### "API key not configured"
- Make sure you've set `ELEVENLABS_API_KEY` in `.env.video`
- Free tier of ElevenLabs includes 10,000 characters/month

### Video rendering fails
- Make sure you have enough disk space (at least 1GB free)
- Check that Chrome/Chromium is installed
- Try increasing `VIDEO_FPS` timeout in `.env.video`

### Audio not included in video
- ElevenLabs API key is invalid
- Script text is too long (max ~500 words recommended)
- Check voiceover generation logs

## Next Steps

After generating videos:
1. Download the MP4 file from `video-generator/output/`
2. Post to social media platforms (Instagram, YouTube, TikTok, Facebook)
3. Edit in video editor if needed (trim, add captions, music, etc.)

## Customization

### Edit Video Templates

Templates are React components in `templates/` directory. You can:
- Change colors and fonts
- Add logos or images
- Modify animations
- Add background music
- Change layout and spacing

Each template component accepts `title` and `script` props.

### Batch Generate Videos

To generate multiple videos, create a `scripts/generate-batch.js`:

```javascript
import { exec } from 'child_process';

const videos = [
  { type: 1, title: 'Tutorial 1', script: '...' },
  { type: 2, title: 'Presentation 1', script: '...' }
];

for (const video of videos) {
  // Generate each video
}
```

## Performance

- Rendering time: ~5-15 minutes per video (depends on system)
- Output quality: 1920x1080 MP4
- File size: ~50-100MB per video
- Storage needed: ~500MB-1GB per video generated

## License

Part of Vendy-Buildr platform.
