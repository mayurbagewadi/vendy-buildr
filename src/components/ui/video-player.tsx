import { useEffect, useRef } from "react";
import Plyr from "plyr-react";
import "plyr-react/plyr.css";

interface VideoPlayerProps {
  url: string;
  className?: string;
}

const VideoPlayer = ({ url, className }: VideoPlayerProps) => {
  // Extract YouTube video ID from various URL formats
  const getYouTubeVideoId = (videoUrl: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ];

    for (const pattern of patterns) {
      const match = videoUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  const videoId = getYouTubeVideoId(url);

  if (!videoId) {
    return (
      <div className={`bg-muted rounded-lg flex items-center justify-center p-8 ${className || ""}`}>
        <p className="text-muted-foreground">Invalid YouTube URL</p>
      </div>
    );
  }

  const plyrProps = {
    source: {
      type: "video" as const,
      sources: [
        {
          src: videoId,
          provider: "youtube" as const,
        },
      ],
    },
    options: {
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "mute",
        "volume",
        "settings",
        "fullscreen",
      ],
      youtube: {
        noCookie: true,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        modestbranding: 1,
      },
    },
  };

  return (
    <div className={className}>
      <Plyr {...plyrProps} />
    </div>
  );
};

export default VideoPlayer;
