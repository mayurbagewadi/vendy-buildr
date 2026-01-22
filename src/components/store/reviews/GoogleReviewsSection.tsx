import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ReviewBadge from "./ReviewBadge";
import ReviewCarousel from "./ReviewCarousel";
import ReviewGrid from "./ReviewGrid";
import ReviewList from "./ReviewList";

interface Review {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  profile_photo_url: string;
  relative_time_description: string;
}

interface ReviewsCache {
  average_rating: number;
  total_reviews: number;
  reviews: Review[];
}

interface GoogleReviewsSectionProps {
  storeId: string;
  variant: "badge" | "badge-compact" | "carousel" | "grid" | "list";
  maxReviews?: number;
  autoPlay?: boolean;
  showAllReviews?: boolean;
}

const GoogleReviewsSection = ({
  storeId,
  variant,
  maxReviews,
  autoPlay = true,
  showAllReviews = false,
}: GoogleReviewsSectionProps) => {
  const [reviewsData, setReviewsData] = useState<ReviewsCache | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    loadReviews();
  }, [storeId]);

  const loadReviews = async () => {
    try {
      // Check if Google Reviews are enabled for this store
      const { data: store } = await supabase
        .from('stores')
        .select('google_reviews_enabled')
        .eq('id', storeId)
        .single();

      if (!store?.google_reviews_enabled) {
        setIsEnabled(false);
        setLoading(false);
        return;
      }

      setIsEnabled(true);

      // Load cached reviews
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
        setReviewsData({
          average_rating: data.average_rating || 0,
          total_reviews: data.total_reviews || 0,
          reviews: data.reviews as Review[] || [],
        });
      }
    } catch (error) {
      console.error('Error in loadReviews:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !isEnabled || !reviewsData || reviewsData.reviews.length === 0) {
    return null;
  }

  switch (variant) {
    case "badge":
      return (
        <ReviewBadge
          averageRating={reviewsData.average_rating}
          totalReviews={reviewsData.total_reviews}
          variant="default"
        />
      );

    case "badge-compact":
      return (
        <ReviewBadge
          averageRating={reviewsData.average_rating}
          totalReviews={reviewsData.total_reviews}
          variant="compact"
        />
      );

    case "carousel":
      return (
        <div className="py-8 md:py-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              What Our Customers Say
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Real reviews from Google
            </p>
          </div>
          <ReviewCarousel reviews={reviewsData.reviews} autoPlay={autoPlay} />
        </div>
      );

    case "grid":
      return (
        <div className="py-8 md:py-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              Customer Reviews
            </h2>
            <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
              <span className="text-lg font-semibold">{reviewsData.average_rating.toFixed(1)}</span>
              <span>•</span>
              <span>{reviewsData.total_reviews} reviews</span>
            </div>
          </div>
          <ReviewGrid reviews={reviewsData.reviews} maxReviews={maxReviews} />
        </div>
      );

    case "list":
      return (
        <div className="py-8">
          <div className="mb-6">
            <h3 className="text-xl md:text-2xl font-bold mb-2">
              Customer Reviews
            </h3>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <span className="text-lg font-semibold">{reviewsData.average_rating.toFixed(1)}</span>
              <span>•</span>
              <span>{reviewsData.total_reviews} Google reviews</span>
            </div>
          </div>
          <ReviewList
            reviews={reviewsData.reviews}
            maxReviews={maxReviews}
            showAllReviews={showAllReviews}
          />
        </div>
      );

    default:
      return null;
  }
};

export default GoogleReviewsSection;
