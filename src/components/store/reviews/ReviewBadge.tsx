import { Star } from "lucide-react";

interface ReviewBadgeProps {
  averageRating: number;
  totalReviews: number;
  variant?: "default" | "compact";
}

const ReviewBadge = ({ averageRating, totalReviews, variant = "default" }: ReviewBadgeProps) => {
  if (variant === "compact") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm">
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {averageRating.toFixed(1)}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          ({totalReviews})
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-1">
        <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          {averageRating.toFixed(1)}
        </span>
      </div>
      <div className="border-l border-gray-300 dark:border-gray-600 h-6" />
      <div className="flex flex-col">
        <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
          Google reviews
        </span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-tight">
          {totalReviews} reviews
        </span>
      </div>
    </div>
  );
};

export default ReviewBadge;
