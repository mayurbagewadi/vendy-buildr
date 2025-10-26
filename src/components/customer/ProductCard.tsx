import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LazyImage from "@/components/ui/lazy-image";
import { motion } from "framer-motion";

interface ProductCardProps {
  id: string;
  name: string;
  category: string;
  priceRange?: string;
  price_range?: string;
  images: string[];
  status: string;
  storeSlug?: string;
}

const ProductCard = ({ id, name, category, priceRange, price_range, images, status, storeSlug }: ProductCardProps) => {
  const imageUrl = images && images.length > 0 ? images[0] : "/placeholder.svg";
  const displayPrice = priceRange || price_range || 'Price on request';
  const productLink = storeSlug ? `/${storeSlug}/products/${id}` : `/products/${id}`;

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
        <CardContent className="p-0">
          <Link to={productLink}>
            <div className="relative aspect-square overflow-hidden bg-muted">
              <LazyImage
                src={imageUrl}
                alt={name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {status === "draft" && (
                <Badge className="absolute top-2 right-2" variant="secondary">
                  Coming Soon
                </Badge>
              )}
            </div>
          </Link>
        </CardContent>
        <CardContent className="p-4">
          <Link to={productLink}>
            <p className="text-xs text-muted-foreground mb-1">{category}</p>
            <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
              {name}
            </h3>
            <p className="text-lg font-bold text-primary">{displayPrice}</p>
          </Link>
        </CardContent>
        <CardFooter className="p-4 pt-0">
          <Link to={productLink} className="w-full">
            <Button className="w-full min-h-[44px]" variant="outline">
              View Details
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default ProductCard;
