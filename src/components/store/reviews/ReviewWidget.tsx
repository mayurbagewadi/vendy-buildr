import { useState, useEffect } from "react";
import { ExternalLink, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Review {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  profile_photo_url: string;
  relative_time_description: string;
}

interface ReviewWidgetProps {
  storeId: string;
  googleMapsUrl: string;
}

const ReviewWidget = ({ storeId, googleMapsUrl }: ReviewWidgetProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviews();
  }, [storeId]);

  const loadReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('google_reviews_cache')
        .select('*')
        .eq('store_id', storeId)
        .single();

      if (error) {
        console.error('Error loading reviews:', error);
        return;
      }

      if (data) {
        setReviews((data.reviews as unknown as Review[]) || []);
        setAverageRating(data.average_rating || 0);
        setTotalReviews(data.total_reviews || 0);
      }
    } catch (error) {
      console.error('Error in loadReviews:', error);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return <div className="text-center py-12">Loading reviews...</div>;
  }

  // If no cached reviews, show simple Google link widget
  if (!reviews || reviews.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardContent className="p-0">
            {/* Google Branding Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <svg className="h-10 w-10" viewBox="0 0 24 24">
                  <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-2xl md:text-3xl font-bold">Customer Reviews</span>
              </div>
              <p className="text-blue-100 text-lg">
                See what our customers are saying
              </p>
            </div>

            {/* CTA Section */}
            <div className="p-8 bg-white dark:bg-gray-800 text-center">
              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="h-8 w-8 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>

                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  Read authentic reviews from our verified customers
                </p>

                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-lg transition-all hover:shadow-lg"
                >
                  <span>View All Reviews on Google</span>
                  <ExternalLink className="h-5 w-5" />
                </a>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Verified by Google • 100% Authentic Customer Feedback
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header with Rating */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">
          What Our Customers Say
        </h2>
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-6 w-6 ${
                  star <= Math.round(averageRating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-gray-200 text-gray-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xl font-bold">{averageRating.toFixed(1)}</span>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Based on {totalReviews} Google reviews
        </p>
      </div>

      {/* Reviews Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {reviews.map((review, index) => (
          <Card key={index} className="hover:shadow-xl transition-shadow border-0 shadow-md">
            <CardContent className="p-6">
              {/* Author Info */}
              <div className="flex items-start gap-3 mb-4">
                {review.profile_photo_url && !imageErrors[index] ? (
                  <img
                    src={review.profile_photo_url}
                    alt={review.author_name}
                    className="h-12 w-12 rounded-full border-2 border-white shadow-md object-cover flex-shrink-0"
                    onError={() => handleImageError(index)}
                    loading="lazy"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className={`h-12 w-12 rounded-full border-2 border-white shadow-md bg-gradient-to-br ${getAvatarColor(review.author_name)} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white font-bold text-sm">
                      {getInitials(review.author_name)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                    {review.author_name}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {review.relative_time_description}
                  </p>
                </div>
              </div>

              {/* Rating */}
              <div className="mb-3">
                {renderStars(review.rating)}
              </div>

              {/* Review Text */}
              {review.text && (
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-4 leading-relaxed">
                  "{review.text}"
                </p>
              )}

              {/* Google Badge */}
              <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-xs text-gray-500 dark:text-gray-400">Posted on Google</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View All Reviews Button */}
      <div className="text-center">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all hover:shadow-lg"
        >
          <span>View All {totalReviews} Reviews on Google</span>
          <ExternalLink className="h-5 w-5" />
        </a>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Verified by Google • {totalReviews} authentic customer reviews
        </p>
      </div>
    </div>
  );
};

export default ReviewWidget;
