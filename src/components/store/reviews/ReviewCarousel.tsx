import { useState } from "react";
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import "./ReviewCarousel.css";

interface Review {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  profile_photo_url: string;
  relative_time_description: string;
}

interface ReviewCarouselProps {
  reviews: Review[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

const ReviewCarousel = ({
  reviews,
  autoPlay = true,
  autoPlayInterval = 5000,
}: ReviewCarouselProps) => {
  const [imageError, setImageError] = useState<Record<number, boolean>>({});

  const handleImageError = (index: number) => {
    setImageError((prev) => ({ ...prev, [index]: true }));
  };

  const getInitials = (name: string) => {
    const words = name.trim().split(" ");
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "from-blue-400 to-blue-600",
      "from-green-400 to-green-600",
      "from-purple-400 to-purple-600",
      "from-pink-400 to-pink-600",
      "from-orange-400 to-orange-600",
      "from-teal-400 to-teal-600",
      "from-indigo-400 to-indigo-600",
      "from-red-400 to-red-600",
    ];
    const hash = name
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-200"
            }`}
          />
        ))}
      </div>
    );
  };

  if (!reviews || reviews.length === 0) {
    return null;
  }

  // Duplicate reviews exactly twice for seamless infinite loop
  const infiniteReviews = [...reviews, ...reviews];

  // Animation duration: slower = smoother scrolling
  // This controls the SPEED of continuous scrolling, not card-by-card timing
  const scrollSpeed = 30; // seconds to scroll through one full set of reviews
  const totalDuration = scrollSpeed * 1000; // Convert to milliseconds

  return (
    <div className="w-full">
      <div className="review-marquee-container overflow-hidden">
        <div
          className="review-marquee-track flex gap-4"
          style={{
            animationDuration: `${totalDuration}ms`,
            animationPlayState: autoPlay ? "running" : "paused",
          }}
        >
          {infiniteReviews.map((review, index) => (
            <Card
              key={`${index}-${review.author_name}`}
              className="review-card flex-shrink-0 w-full sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.667rem)] lg:w-[calc(20%-0.8rem)] border-0 shadow-md hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-4 md:p-5 h-full flex flex-col">
                {/* Header: Name and Stars */}
                <div className="flex flex-col gap-2 mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base truncate flex-1">
                      {review.author_name}
                    </h4>
                  </div>
                  {renderStars(review.rating)}
                </div>

                {/* Google Badge */}
                <div className="flex items-center gap-1.5 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Posted on Google
                  </span>
                </div>

                {/* Avatar and Time */}
                <div className="flex items-start gap-2 mb-3">
                  {review.profile_photo_url && !imageError[index % reviews.length] ? (
                    <img
                      src={review.profile_photo_url}
                      alt={review.author_name}
                      className="h-10 w-10 md:h-12 md:w-12 rounded-full border-2 border-white shadow-md object-cover flex-shrink-0"
                      onError={() =>
                        handleImageError(index % reviews.length)
                      }
                      loading="lazy"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div
                      className={`h-10 w-10 md:h-12 md:w-12 rounded-full border-2 border-white shadow-md bg-gradient-to-br ${getAvatarColor(
                        review.author_name
                      )} flex items-center justify-center flex-shrink-0`}
                    >
                      <span className="text-white font-bold text-xs md:text-sm">
                        {getInitials(review.author_name)}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex-1">
                    {review.relative_time_description}
                  </p>
                </div>

                {/* Review Text */}
                {review.text && (
                  <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 line-clamp-3 leading-relaxed flex-1">
                    "{review.text}"
                  </p>
                )}

                {/* Read More Link */}
                <button className="text-xs text-primary hover:underline mt-auto pt-2 text-left font-medium">
                  Read more
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Scroll hint for mobile */}
      <div className="text-center mt-4 md:hidden">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          ← Swipe to see more reviews →
        </p>
      </div>
    </div>
  );
};

export default ReviewCarousel;
