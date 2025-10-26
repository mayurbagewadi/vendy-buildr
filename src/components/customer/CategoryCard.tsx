import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";
import { convertToDirectImageUrl } from "@/lib/imageUtils";
import LazyImage from "@/components/ui/lazy-image";
import { motion } from "framer-motion";

interface CategoryCardProps {
  name: string;
  image_url?: string | null;
  productCount?: number;
  slug?: string;
}

const CategoryCard = ({ name, image_url, productCount = 0, slug }: CategoryCardProps) => {
  const categoryLink = slug 
    ? `/${slug}/products?category=${encodeURIComponent(name)}`
    : `/products?category=${encodeURIComponent(name)}`;
  
  const directImageUrl = convertToDirectImageUrl(image_url);

  return (
    <Link to={categoryLink} className="block p-2">
      <motion.div
        whileHover={{ y: -8, scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="group h-full"
      >
        <Card className="relative h-full border-2 border-transparent bg-card/50 backdrop-blur-sm hover:bg-card hover:border-primary transition-all duration-500 shadow-md hover:shadow-[0_5px_40px_-20px_rgba(0,0,0,0.4)] rounded-2xl">
          <CardContent className="p-0 relative">
            {/* Image Container with Gradient Overlay */}
            <div className="relative aspect-square overflow-hidden rounded-xl">
              {directImageUrl ? (
                <>
                  <LazyImage
                    src={directImageUrl}
                    alt={name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 brightness-90 group-hover:brightness-100"
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent opacity-80 group-hover:opacity-70 transition-opacity duration-500" />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted">
                  <Package className="w-16 h-16 text-muted-foreground/30 group-hover:text-primary/50 transition-colors duration-500" />
                </div>
              )}

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
    </Link>
  );
};

export default CategoryCard;
