import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { convertToDirectImageUrl } from "@/lib/imageUtils";
import { generateCategoryImageAlt } from "@/lib/seo/altTags";
import LazyImage from "@/components/ui/lazy-image";
import { motion } from "framer-motion";
import { useState } from "react";
import { isStoreSpecificDomain } from "@/lib/domainUtils";

interface CategoryCardProps {
  name: string;
  image_url?: string | null;
  productCount?: number;
  slug?: string;
}

const CategoryCard = ({ name, image_url, productCount = 0, slug }: CategoryCardProps) => {
  const navigate = useNavigate();
  const [isAnimating, setIsAnimating] = useState(false);

  // On store-specific domains (subdomain/custom), don't include slug in URL
  // On main platform, include slug prefix
  const isOnStoreSpecificDomain = isStoreSpecificDomain();
  const categoryLink = isOnStoreSpecificDomain
    ? `/products?category=${encodeURIComponent(name)}`
    : (slug ? `/${slug}/products?category=${encodeURIComponent(name)}` : `/products?category=${encodeURIComponent(name)}`);

  // Default images for categories without custom images
  const defaultCategoryImages = [
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&h=500&fit=crop",
  ];
  
  // Use a consistent default image based on category name hash
  const getDefaultImage = () => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return defaultCategoryImages[hash % defaultCategoryImages.length];
  };

  const directImageUrl = image_url ? convertToDirectImageUrl(image_url) : getDefaultImage();

  const handleClick = () => {
    if (isAnimating) return;

    setIsAnimating(true);
    setTimeout(() => {
      navigate(categoryLink);
    }, 700);
  };

  return (
    <div className="block p-2 cursor-pointer" onClick={handleClick}>
      <motion.div
        whileHover={{ y: -8, scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="group h-full"
        animate={isAnimating ? { scale: 0.95 } : { scale: 1 }}
      >
        <Card className="relative h-full border-2 border-transparent bg-card/50 backdrop-blur-sm hover:bg-card hover:border-primary transition-all duration-500 shadow-md hover:shadow-[0_5px_40px_-20px_rgba(0,0,0,0.4)] rounded-2xl">
          <CardContent className="p-0 relative">
            {/* Image Container with Gradient Overlay */}
            <div className="relative aspect-square overflow-hidden rounded-xl">
              <LazyImage
                src={directImageUrl}
                alt={generateCategoryImageAlt(name)}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 brightness-90 group-hover:brightness-100"
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent opacity-80 group-hover:opacity-70 transition-opacity duration-500" />

              {/* Category Name Overlay */}
              <div className="absolute inset-x-0 bottom-0 p-3 transform translate-y-0 transition-transform duration-500">
                <h3 className="font-bold text-base md:text-lg text-foreground drop-shadow-lg transition-colors duration-300">
                  {name}
                </h3>
                {productCount !== undefined && (
                  <p className="text-xs text-muted-foreground mt-1 opacity-90 group-hover:text-primary transition-colors duration-300">
                    {productCount} {productCount === 1 ? 'product' : 'products'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default CategoryCard;
