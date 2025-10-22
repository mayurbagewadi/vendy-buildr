
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LazyImage from "@/components/ui/lazy-image";

interface ProductCardProps {
  id: string;
  name: string;
  category: string;
  priceRange?: string;
  price_range?: string;
  images: string[];
  status: string;
}

const ProductCard = ({ id, name, category, priceRange, price_range, images, status }: ProductCardProps) => {
  const imageUrl = images && images.length > 0 ? images[0] : "/placeholder.svg";
  const displayPrice = priceRange || price_range || 'Price on request';

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
      <a href={`/products/${id}`} target="_blank" rel="noopener noreferrer">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <LazyImage
            src={imageUrl}
            alt={name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
          {status === "draft" && (
            <Badge className="absolute top-2 right-2" variant="secondary">
              Coming Soon
            </Badge>
          )}
        </div>
      </a>
      <CardContent className="p-4">
        <a href={`/products/${id}`} target="_blank" rel="noopener noreferrer">
          <p className="text-xs text-muted-foreground mb-1">{category}</p>
          <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {name}
          </h3>
          <p className="text-lg font-bold text-primary">{displayPrice}</p>
        </a>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <a href={`/products/${id}`} target="_blank" rel="noopener noreferrer" className="w-full">
          <Button className="w-full min-h-[44px]" variant="outline">
            View Details
          </Button>
        </a>
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
