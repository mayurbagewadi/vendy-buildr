import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";

interface CategoryCardProps {
  name: string;
  image_url?: string | null;
  productCount?: number;
  slug?: string;
}

const CategoryCard = ({ name, image_url, productCount = 0, slug }: CategoryCardProps) => {
  const categoryLink = slug 
    ? `/store/${slug}?category=${encodeURIComponent(name)}`
    : `/products?category=${encodeURIComponent(name)}`;

  return (
    <Link to={categoryLink}>
      <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden h-full">
        <CardContent className="p-0">
          <div className="relative aspect-square overflow-hidden bg-muted">
            {image_url ? (
              <img
                src={image_url}
                alt={name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-16 h-16 text-muted-foreground/50" />
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
              {name}
            </h3>
            {productCount > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {productCount} {productCount === 1 ? 'product' : 'products'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default CategoryCard;
