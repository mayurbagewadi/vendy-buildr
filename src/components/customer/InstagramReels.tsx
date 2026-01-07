import { useState, useEffect } from "react";
import { Instagram, Play, ExternalLink } from "lucide-react";

interface Reel {
  id: string;
  type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  timestamp?: string;
}

interface ReelsSettings {
  enabled: boolean;
  display_mode: string;
  max_reels: number;
  manual_reels: { url: string; thumbnail_url?: string; caption?: string }[];
  show_on_homepage: boolean;
  section_title: string;
}

interface InstagramReelsProps {
  storeId: string;
  settings?: ReelsSettings;
  instagramUsername?: string;
}

const InstagramReels = ({ storeId, settings, instagramUsername }: InstagramReelsProps) => {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings?.enabled) {
      fetchReels();
    } else {
      setLoading(false);
    }
  }, [storeId, settings?.enabled]);

  const fetchReels = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/instagram-fetch-reels?store_id=${storeId}`
      );

      const data = await response.json();

      if (data.success) {
        setReels(data.reels || []);
      } else {
        console.log("Failed to fetch reels:", data.error);
        // Don't show error, just use manual reels if available
        if (settings?.manual_reels?.length) {
          setReels(settings.manual_reels.map(r => ({
            id: r.url,
            type: "manual",
            permalink: r.url,
            thumbnail_url: r.thumbnail_url,
            caption: r.caption,
          })));
        }
      }
    } catch (err) {
      console.error("Error fetching reels:", err);
      // Fallback to manual reels
      if (settings?.manual_reels?.length) {
        setReels(settings.manual_reels.map(r => ({
          id: r.url,
          type: "manual",
          permalink: r.url,
          thumbnail_url: r.thumbnail_url,
          caption: r.caption,
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  // Don't render if disabled or no reels
  if (!settings?.enabled) {
    return null;
  }

  if (loading) {
    return (
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Instagram className="w-6 h-6 text-pink-500" />
              <h2 className="text-2xl font-bold">{settings?.section_title || "Follow Us on Instagram"}</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[9/16] bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (reels.length === 0) {
    return null;
  }

  const extractReelId = (url: string) => {
    const match = url.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/);
    return match ? match[2] : null;
  };

  return (
    <section className="py-12 px-4 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Instagram className="w-6 h-6 text-pink-500" />
            <h2 className="text-2xl font-bold">{settings?.section_title || "Follow Us on Instagram"}</h2>
          </div>
          {instagramUsername && (
            <a
              href={`https://instagram.com/${instagramUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-pink-500 transition-colors inline-flex items-center gap-1"
            >
              @{instagramUsername}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Reels Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
          {reels.slice(0, settings?.max_reels || 6).map((reel) => (
            <ReelCard key={reel.id} reel={reel} />
          ))}
        </div>

        {/* Follow Button */}
        {instagramUsername && (
          <div className="text-center mt-8">
            <a
              href={`https://instagram.com/${instagramUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-medium rounded-full hover:opacity-90 transition-opacity"
            >
              <Instagram className="w-5 h-5" />
              Follow on Instagram
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

// Individual Reel Card Component
const ReelCard = ({ reel }: { reel: Reel }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <a
      href={reel.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="relative aspect-[9/16] rounded-lg overflow-hidden bg-muted group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail */}
      {reel.thumbnail_url ? (
        <img
          src={reel.thumbnail_url}
          alt={reel.caption || "Instagram Reel"}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-orange-500/20">
          <Instagram className="w-12 h-12 text-pink-500/50" />
        </div>
      )}

      {/* Play Icon Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
          <Play className="w-6 h-6 text-pink-500 ml-1" fill="currentColor" />
        </div>
      </div>

      {/* Reel Icon Badge */}
      <div className="absolute top-2 right-2">
        <div className="w-6 h-6 rounded bg-black/50 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
          </svg>
        </div>
      </div>

      {/* Caption (shown on hover) */}
      {reel.caption && (
        <div className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-white text-xs line-clamp-2">{reel.caption}</p>
        </div>
      )}
    </a>
  );
};

export default InstagramReels;
