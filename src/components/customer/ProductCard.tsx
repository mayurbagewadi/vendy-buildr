import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LazyImage from "@/components/ui/lazy-image";
import { generateProductImageAlt } from "@/lib/seo/altTags";
import { motion } from "framer-motion";
import { useState } from "react";
import { isStoreSpecificDomain } from "@/lib/domainUtils";

interface ProductCardProps {
  id: string;
  slug?: string;
  name: string;
  category: string;
  priceRange?: string;
  price_range?: string;
  images: string[];
  status: string;
  storeSlug?: string;
}

const ProductCard = ({ id, slug, name, category, priceRange, price_range, images, status, storeSlug }: ProductCardProps) => {
  const navigate = useNavigate();
  const [isAnimating, setIsAnimating] = useState(false);

  const imageUrl = images && images.length > 0 ? images[0] : "/placeholder.svg";
  const displayPrice = priceRange || price_range || 'Price on request';

  // Use slug for SEO-friendly URLs, fallback to id if slug doesn't exist
  const productIdentifier = slug || id;

  // On store-specific domains (subdomain/custom), don't include slug in URL
  // On main platform, include slug prefix
  const isOnStoreSpecificDomain = isStoreSpecificDomain();
  const productLink = isOnStoreSpecificDomain
    ? `/products/${productIdentifier}`
    : (storeSlug ? `/${storeSlug}/products/${productIdentifier}` : `/products/${productIdentifier}`);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAnimating) return;

    setIsAnimating(true);
    setTimeout(() => {
      navigate(productLink);
    }, 700);
  };

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      animate={isAnimating ? { scale: 0.95 } : { scale: 1 }}
      onClick={handleClick}
      className="cursor-pointer"
    >
      <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-square overflow-hidden bg-muted">
            <LazyImage
              src={imageUrl}
              alt={generateProductImageAlt({
                productName: name,
                storeName: storeSlug,
                category: category || undefined
              })}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {status === "draft" && (
              <Badge className="absolute top-2 right-2" variant="secondary">
                Coming Soon
              </Badge>
            )}
          </div>
        </CardContent>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">{category}</p>
          <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {name}
          </h3>
          <p className="text-lg font-bold text-primary">{displayPrice}</p>
        </CardContent>
        <CardFooter className="p-4 pt-0">
          <Button className="w-full min-h-[44px]" variant="outline">
            View Details
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default ProductCard;
