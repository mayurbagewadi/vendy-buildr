import { Star, User } from "lucide-react";
import { useState } from "react";

interface Review {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  profile_photo_url: string;
  relative_time_description: string;
}

interface ReviewListProps {
  reviews: Review[];
  maxReviews?: number;
  showAllReviews?: boolean;
}

const ReviewList = ({ reviews, maxReviews = 5, showAllReviews = false }: ReviewListProps) => {
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'
            }`}
          />
        ))}
      </div>
    );
  };

  const handleImageError = (index: number) => {
    setImageErrors(prev => ({ ...prev, [index]: true }));
  };

  const getInitials = (name: string) => {
    const words = name.trim().split(' ');
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-blue-400 to-blue-600',
      'from-green-400 to-green-600',
      'from-purple-400 to-purple-600',
      'from-pink-400 to-pink-600',
      'from-orange-400 to-orange-600',
      'from-teal-400 to-teal-600',
      'from-indigo-400 to-indigo-600',
      'from-red-400 to-red-600',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (!reviews || reviews.length === 0) {
    return null;
  }

  const displayReviews = showAllReviews ? reviews : reviews.slice(0, maxReviews);

  return (
    <div className="space-y-4">
      {displayReviews.map((review, index) => (
        <div
          key={index}
          className="p-4 md:p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
        >
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                {review.profile_photo_url && !imageErrors[index] ? (
                  <img
                    src={review.profile_photo_url}
                    alt={review.author_name}
                    className="h-12 w-12 rounded-full border-2 border-white shadow-md object-cover"
                    onError={() => handleImageError(index)}
                    loading="lazy"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className={`h-12 w-12 rounded-full border-2 border-white shadow-md bg-gradient-to-br ${getAvatarColor(review.author_name)} flex items-center justify-center`}>
                    <span className="text-white font-bold text-sm">
                      {getInitials(review.author_name)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {review.author_name}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {review.relative_time_description}
                  </p>
                  <div className="mt-1">{renderStars(review.rating)}</div>
                </div>
              </div>

              {/* Google Badge */}
              <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-700 rounded">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
            </div>

            {/* Review Text */}
            {review.text && (
              <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                {review.text}
              </p>
            )}
          </div>
        </div>
      ))}

      {!showAllReviews && reviews.length > maxReviews && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center pt-2">
          + {reviews.length - maxReviews} more reviews
        </p>
      )}
    </div>
  );
};

export default ReviewList;
