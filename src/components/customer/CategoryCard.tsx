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
      <Card className="group hover:shadow-2xl transition-all duration-500 overflow-hidden h-full border-0 bg-card/50 backdrop-blur-sm hover:bg-card">
        <CardContent className="p-0 relative">
          {/* Image Container with Gradient Overlay */}
          <div className="relative aspect-square overflow-hidden">
            {image_url ? (
              <>
                <img
                  src={image_url}
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
            <div className="absolute inset-x-0 bottom-0 p-4 transform translate-y-0 transition-transform duration-500">
              <h3 className="font-bold text-lg md:text-xl text-foreground drop-shadow-lg group-hover:text-primary transition-colors duration-300">
                {name}
              </h3>
              {productCount > 0 && (
                <p className="text-xs md:text-sm text-muted-foreground mt-1 opacity-90">
                  {productCount} {productCount === 1 ? 'product' : 'products'}
                </p>
              )}
            </div>
            
            {/* Hover Border Effect */}
            <div className="absolute inset-0 border-2 border-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default CategoryCard;
