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
  basePrice?: number;
  base_price?: number;
  offerPrice?: number;
  offer_price?: number;
  variants?: Array<{ name: string; price: number; offer_price?: number }>;
  images: string[];
  status: string;
  storeSlug?: string;
}

const ProductCard = ({ id, slug, name, category, priceRange, price_range, basePrice, base_price, offerPrice, offer_price, variants, images, status, storeSlug }: ProductCardProps) => {
  const navigate = useNavigate();
  const [isAnimating, setIsAnimating] = useState(false);

  const imageUrl = images && images.length > 0 ? images[0] : "/placeholder.svg";
  const displayPrice = priceRange || price_range || 'Price on request';

  // Offer price logic
  const sellingPrice = basePrice || base_price;
  const activeOfferPrice = offerPrice || offer_price;

  // Variant mode: find highest discount %
  const variantMaxDiscount = (() => {
    if (!variants || variants.length === 0) return 0;
    let max = 0;
    for (const v of variants) {
      if (v.offer_price && v.offer_price > 0 && v.offer_price < v.price) {
        const pct = Math.round((v.price - v.offer_price) / v.price * 100);
        if (pct > max) max = pct;
      }
    }
    return max;
  })();

  // Single price: discount %
  const singleDiscount = sellingPrice && activeOfferPrice && activeOfferPrice > 0 && activeOfferPrice < sellingPrice
    ? Math.round((sellingPrice - activeOfferPrice) / sellingPrice * 100)
    : 0;

  const discountPct = singleDiscount || variantMaxDiscount;
  const isVariantMode = variants && variants.length > 0;

  // Fallback for variant products where base_price/offer_price columns are null in DB.
  // Picks the variant with the lowest offer_price and uses its price pair for display.
  const variantDisplayPrices = (() => {
    if (!isVariantMode || singleDiscount > 0) return null;
    const withOffer = (variants || []).filter(v => v.offer_price && v.offer_price > 0 && v.offer_price < v.price);
    if (withOffer.length === 0) return null;
    const cheapest = withOffer.reduce((min, v) => v.offer_price! < min.offer_price! ? v : min);
    return { offer: cheapest.offer_price!, selling: cheapest.price };
  })();

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
      className="cursor-pointer w-[90%] mx-auto mb-6"
      data-ai="product-card"
    >
      <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden !rounded-[1.55rem]">
        {/* ═══ PRODUCT CARD ═══
            Purpose: Individual product display card in grid/list
            Content: Product image, category tag, name, price, "View Details" button
            AI Can Change: Card background, border radius, shadow effects, spacing, image size, text colors, button styles
            Selectors: [data-ai="product-card"] - affects all product cards
        */}
        <CardContent className="p-0">
          <div className="relative aspect-[5/4] overflow-hidden bg-muted">
            <LazyImage
              src={imageUrl}
              alt={generateProductImageAlt({
                productName: name,
                storeName: storeSlug,
                category: category || undefined
              })}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {discountPct > 0 && (
              <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">
                {isVariantMode ? `Upto ${discountPct}% off` : `${discountPct}% off`}
              </div>
            )}
            {status === "draft" && (
              <Badge className="absolute top-2 right-2" variant="secondary">
                Coming Soon
              </Badge>
            )}
          </div>
        </CardContent>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground mb-1">{category}</p>
          <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-2">
            {name}
          </h3>
          {singleDiscount > 0 && sellingPrice && activeOfferPrice ? (
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-primary">₹{activeOfferPrice.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground line-through">₹{sellingPrice.toFixed(2)}</p>
            </div>
          ) : variantDisplayPrices ? (
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-primary">₹{variantDisplayPrices.offer.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground line-through">₹{variantDisplayPrices.selling.toFixed(2)}</p>
            </div>
          ) : (
            <p className="text-lg font-bold text-primary">{displayPrice}</p>
          )}
        </CardContent>
        <CardFooter className="p-3 pt-0">
          <Button className="w-full min-h-[44px]" variant="default">
            View Details
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default ProductCard;
