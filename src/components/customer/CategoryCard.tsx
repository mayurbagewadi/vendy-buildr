import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { convertToDirectImageUrl } from "@/lib/imageUtils";
import { generateCategoryImageAlt } from "@/lib/seo/altTags";
import LazyImage from "@/components/ui/lazy-image";
import { isStoreSpecificDomain } from "@/lib/domainUtils";

interface CategoryCardProps {
  name: string;
  image_url?: string | null;
  productCount?: number;
  slug?: string;
  priorityImage?: boolean;
}

const CategoryCard = ({ name, image_url, productCount = 0, slug, priorityImage = false }: CategoryCardProps) => {
  const navigate = useNavigate();

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
    navigate(categoryLink);
  };

  return (
    <div
      className="block p-2 cursor-pointer outline-none rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      data-ai="category-card"
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(categoryLink);
        }
      }}
      role="link"
      tabIndex={0}
    >
      {/* ═══ CATEGORY CARD ═══
          Purpose: Individual category display in horizontal scrollable list
          Content: Category image, category name, product count badge
          AI Can Change: Card border radius, shadow effects, spacing, image size, text colors, badge styles, hover effects
          Selectors:
            [data-ai="category-card"]                → outer wrapper (padding, spacing)
            [data-ai="category-card-inner"]          → Card shell (border, shadow, background, border-radius)
            [data-ai="category-card-image-container"] → photo box (aspect ratio, size, shape)
            [data-ai="category-card-image"]          → the photo itself (object-fit, brightness, scale)
            [data-ai="category-card-overlay"]        → gradient overlay on photo (color, opacity)
            [data-ai="category-card-name"]           → category name text (font, size, color, weight)
            [data-ai="category-card-count"]          → product count text (font, size, color)
      */}
      <div className="group h-full motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.01] motion-safe:active:scale-[0.98]">
        <Card data-ai="category-card-inner" className="relative h-full border-2 border-transparent bg-card/50 backdrop-blur-sm shadow-sm transition-[background-color,border-color,box-shadow] duration-200 hover:bg-card hover:border-primary/50 hover:shadow-md rounded-2xl">
          <CardContent className="p-0 relative">
            {/* Image Container with Gradient Overlay */}
            <div data-ai="category-card-image-container" className="relative aspect-square overflow-hidden rounded-xl">
              <LazyImage
                src={directImageUrl}
                alt={generateCategoryImageAlt(name)}
                data-ai="category-card-image"
                className="w-full h-full object-cover brightness-90 motion-safe:transition-[transform,filter] motion-safe:duration-300 motion-safe:group-hover:scale-[1.03] group-hover:brightness-100"
                priority={priorityImage}
              />
              {/* Gradient Overlay */}
              <div data-ai="category-card-overlay" className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent opacity-80 group-hover:opacity-70 transition-opacity duration-200" />

              {/* Category Name Overlay */}
              <div className="absolute inset-x-0 bottom-0 p-3">
                <h3 data-ai="category-card-name" className="font-bold text-base md:text-lg text-foreground drop-shadow-lg transition-colors duration-200">
                  {name}
                </h3>
                {productCount !== undefined && (
                  <p data-ai="category-card-count" className="text-xs text-muted-foreground mt-1 opacity-90 group-hover:text-primary transition-colors duration-200">
                    {productCount} {productCount === 1 ? 'product' : 'products'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CategoryCard;
