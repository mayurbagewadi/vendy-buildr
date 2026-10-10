import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Customer Reviews plugin (slug: customer-reviews) — Google reviews the store
// owner copies in manually. Data comes from one RPC that already returns
// nothing when the plugin is not installed. The section stays hidden when there
// are no visible reviews; the "See all reviews on Google" button is optional.

interface CustomerReview {
  id: string;
  customer_name: string;
  rating: number;
  review_text: string;
  review_date: string;
}

interface CustomerReviewsData {
  google_url: string | null;
  reviews: CustomerReview[];
}

// 4+ reviews auto-scroll; fewer are shown centred and static.
const MARQUEE_MIN_REVIEWS = 4;
const SCROLL_SPEED_PX_PER_SEC = 40;
const RESUME_DELAY_MS = 2500;

// Same Google-only host rule as the admin page; guards the outbound button.
const isGoogleReviewsUrl = (value: string | null) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host) ||
      host === "goo.gl" ||
      host === "maps.app.goo.gl" ||
      host === "g.page" ||
      host === "g.co"
    );
  } catch {
    return false;
  }
};

const relativeDate = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.round((today.getTime() - date.getTime()) / 86400000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
};

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const AVATAR_COLORS = [
  "from-blue-400 to-blue-600",
  "from-green-400 to-green-600",
  "from-purple-400 to-purple-600",
  "from-pink-400 to-pink-600",
  "from-orange-400 to-orange-600",
  "from-teal-400 to-teal-600",
  "from-indigo-400 to-indigo-600",
  "from-red-400 to-red-600",
];

const getAvatarColor = (name: string) => {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

// Official Google "G" — same paths as the Google Reviews plugin cards.
const GoogleG = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const Stars = ({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) => (
  <div className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={`${size} ${star <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "fill-muted text-muted"}`}
      />
    ))}
  </div>
);

const ReviewCard = ({ review, duplicate = false }: { review: CustomerReview; duplicate?: boolean }) => (
  <article
    data-ai="customer-review-card"
    aria-hidden={duplicate || undefined}
    className="w-[280px] sm:w-[320px] shrink-0 bg-card text-card-foreground border rounded-[var(--radius)] p-5 shadow-sm flex flex-col gap-3"
  >
    <div className="flex items-start gap-3">
      <div
        className={`h-11 w-11 shrink-0 rounded-full bg-gradient-to-br ${getAvatarColor(review.customer_name)} flex items-center justify-center`}
      >
        <span className="text-white font-semibold text-sm">{getInitials(review.customer_name)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-sm md:text-base leading-tight truncate">{review.customer_name}</h3>
        <time dateTime={review.review_date} className="text-xs text-muted-foreground">
          {relativeDate(review.review_date)}
        </time>
      </div>
      <GoogleG className="h-5 w-5 shrink-0" />
    </div>
    <Stars rating={review.rating} size="h-5 w-5" />
    <p className="text-sm leading-relaxed whitespace-pre-line break-words line-clamp-5">
      {review.review_text}
    </p>
  </article>
);

interface CustomerReviewsSectionProps {
  storeId: string;
  className?: string;
}

const CustomerReviewsSection = ({ storeId, className = "py-16" }: CustomerReviewsSectionProps) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // True only when one set of cards is wider than the screen; otherwise the
  // cards are centred and nothing moves (avoids a stuck/jumping loop on wide screens).
  const [overflowing, setOverflowing] = useState(false);

  const { data } = useQuery({
    queryKey: ["storefront-customer-reviews", storeId],
    queryFn: async (): Promise<CustomerReviewsData> => {
      const { data, error } = await (supabase as any).rpc("get_store_customer_reviews", {
        p_store_id: storeId,
      });
      if (error) throw error;
      return (data as CustomerReviewsData) || { google_url: null, reviews: [] };
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const reviews = data?.reviews || [];
  const googleUrl = isGoogleReviewsUrl(data?.google_url ?? null) ? data!.google_url! : null;
  const isMarquee = reviews.length >= MARQUEE_MIN_REVIEWS;

  useEffect(() => {
    const el = scrollerRef.current;
    const track = trackRef.current;
    if (!el || !track || !isMarquee) return;

    const measure = () => {
      const cards = track.children;
      const first = cards[0] as HTMLElement | undefined;
      const lastOfSet = cards[reviews.length - 1] as HTMLElement | undefined;
      if (!first || !lastOfSet) return;
      const setWidth = lastOfSet.offsetLeft + lastOfSet.offsetWidth - first.offsetLeft;
      setOverflowing(setWidth > el.clientWidth);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isMarquee, reviews.length]);

  // Auto-scroll left on a native scroll container: shoppers can still swipe/drag,
  // and it pauses on hover/touch, while off-screen, and for reduced-motion users.
  // The list is rendered twice so wrapping back by half the width is seamless.
  useEffect(() => {
    const el = scrollerRef.current;
    const track = trackRef.current;
    if (!el || !track || !isMarquee || !overflowing) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let lastTime = 0;
    let pos = el.scrollLeft;
    let paused = false;
    let visible = true;
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;

    // Exact distance between a card and its duplicate = one full loop.
    const loopWidth = () => {
      const first = track.children[0] as HTMLElement | undefined;
      const dup = track.children[reviews.length] as HTMLElement | undefined;
      return first && dup ? dup.offsetLeft - first.offsetLeft : el.scrollWidth / 2;
    };

    const step = (time: number) => {
      if (lastTime && !paused && visible) {
        const half = loopWidth();
        pos += (SCROLL_SPEED_PX_PER_SEC * (time - lastTime)) / 1000;
        if (pos >= half) pos -= half;
        el.scrollLeft = pos;
      }
      lastTime = time;
      frame = requestAnimationFrame(step);
    };

    const pause = () => {
      paused = true;
      if (resumeTimer) clearTimeout(resumeTimer);
    };
    const resumeLater = (delay: number) => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        const half = loopWidth();
        pos = el.scrollLeft >= half ? el.scrollLeft - half : el.scrollLeft;
        paused = false;
      }, delay);
    };
    const onMouseLeave = () => resumeLater(0);
    const onTouchEnd = () => resumeLater(RESUME_DELAY_MS);

    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("focusin", pause);
    el.addEventListener("focusout", onMouseLeave);

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(el);

    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      if (resumeTimer) clearTimeout(resumeTimer);
      observer.disconnect();
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", onMouseLeave);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("focusin", pause);
      el.removeEventListener("focusout", onMouseLeave);
    };
  }, [isMarquee, overflowing, reviews.length]);

  if (reviews.length === 0) return null;

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <section data-ai="section-customer-reviews" className={`${className} bg-muted/30`}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">What Our Customers Say</h2>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <Stars rating={average} size="h-5 w-5" />
            <span className="font-semibold">{average.toFixed(1)} out of 5</span>
            <span className="text-sm text-muted-foreground">
              · {reviews.length} review{reviews.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {isMarquee ? (
        <div
          ref={scrollerRef}
          role="region"
          aria-label="Customer reviews"
          tabIndex={0}
          className={`overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            overflowing ? "[mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]" : ""
          }`}
        >
          <div ref={trackRef} className="flex w-max mx-auto gap-4 md:gap-6 px-4 py-2">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
            {overflowing &&
              reviews.map((review) => (
                <ReviewCard key={`dup-${review.id}`} review={review} duplicate />
              ))}
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </div>
      )}

      {googleUrl && (
      <div className="container mx-auto px-4 flex justify-center mt-8">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-2 rounded-[var(--radius)] border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <GoogleG className="h-4 w-4" />
          See all reviews on Google
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      )}
    </section>
  );
};

export default CustomerReviewsSection;
