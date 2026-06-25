import { forwardRef, useEffect, useMemo, useState } from "react";
import { convertToDirectImageUrl } from "@/lib/imageUtils";
import { cn } from "@/lib/utils";

type StorefrontImagePurpose =
  | "product-card"
  | "product-detail"
  | "cart-thumb"
  | "category-card"
  | "hero-banner"
  | "logo";

interface StorefrontImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "loading"> {
  src: string | null | undefined;
  alt: string;
  purpose: StorefrontImagePurpose;
  priority?: boolean;
  fallback?: string;
}

const PURPOSE_SIZES: Record<StorefrontImagePurpose, string> = {
  "product-card": "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 360px",
  "product-detail": "(max-width: 1024px) 100vw, 640px",
  "cart-thumb": "96px",
  "category-card": "(max-width: 640px) 50vw, 320px",
  "hero-banner": "100vw",
  logo: "128px",
};

const StorefrontImage = forwardRef<HTMLImageElement, StorefrontImageProps>(({
  src,
  alt,
  purpose,
  priority = false,
  fallback = "/placeholder.svg",
  className,
  sizes,
  onLoad,
  onError,
  ...props
}, ref) => {
  const imageSrc = useMemo(() => convertToDirectImageUrl(src) || src || fallback, [fallback, src]);
  const [currentSrc, setCurrentSrc] = useState(imageSrc);
  const [loaded, setLoaded] = useState(priority);

  useEffect(() => {
    setCurrentSrc(imageSrc);
    setLoaded(false);
  }, [imageSrc]);

  return (
    <img
      src={currentSrc}
      ref={ref}
      alt={alt}
      sizes={sizes || PURPOSE_SIZES[purpose]}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn(
        "bg-muted transition-[opacity,filter,transform] duration-700 ease-out",
        loaded ? "opacity-100 blur-0 scale-100" : "opacity-35 blur-xl scale-[1.015]",
        className
      )}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
      onError={(event) => {
        if (currentSrc !== fallback) {
          setCurrentSrc(fallback);
          setLoaded(false);
        }
        onError?.(event);
      }}
      {...props}
    />
  );
});

StorefrontImage.displayName = "StorefrontImage";

export default StorefrontImage;
