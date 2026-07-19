import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { convertToDirectImageUrl } from "@/lib/imageUtils";
import { getImageSrcSet, getImageUrl, type StorefrontImageSource } from "@/lib/responsiveImages";
import { cn } from "@/lib/utils";

type StorefrontImagePurpose =
  | "product-card"
  | "product-detail"
  | "cart-thumb"
  | "category-card"
  | "hero-banner"
  | "logo";

interface StorefrontImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "loading"> {
  src: StorefrontImageSource;
  alt: string;
  purpose: StorefrontImagePurpose;
  priority?: boolean;
  fallback?: string;
  preloadMargin?: string;
}

const PURPOSE_SIZES: Record<StorefrontImagePurpose, string> = {
  "product-card": "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 360px",
  "product-detail": "(max-width: 1024px) 100vw, 640px",
  "cart-thumb": "96px",
  "category-card": "(max-width: 640px) 50vw, 320px",
  "hero-banner": "100vw",
  logo: "128px",
};

const CLARITY_STEPS = [0, 0.1, 0.2, 0.35, 0.5, 0.7, 0.85, 1];

const StorefrontImage = forwardRef<HTMLImageElement, StorefrontImageProps>(({
  src,
  alt,
  purpose,
  priority = false,
  fallback = "/placeholder.svg",
  preloadMargin = "1200px 0px",
  className,
  sizes,
  style,
  onLoad,
  onError,
  ...props
}, ref) => {
  const rawImageSrc = useMemo(() => getImageUrl(src, fallback), [fallback, src]);
  const imageSrc = useMemo(() => convertToDirectImageUrl(rawImageSrc) || rawImageSrc || fallback, [fallback, rawImageSrc]);
  const srcSet = useMemo(() => getImageSrcSet(src), [src]);
  const [currentSrc, setCurrentSrc] = useState(fallback);
  const [opacity, setOpacity] = useState(0);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const revealTimersRef = useRef<number[]>([]);
  const setRefs = useCallback((node: HTMLImageElement | null) => {
    setImageElement(node);

    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  useEffect(() => {
    if (priority) {
      setShouldLoad(true);
      return;
    }

    setShouldLoad(false);

    if (!imageElement) return;

    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: preloadMargin }
    );

    observer.observe(imageElement);

    return () => {
      observer.disconnect();
    };
  }, [imageElement, imageSrc, preloadMargin, priority]);

  useEffect(() => {
    let cancelled = false;

    revealTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    revealTimersRef.current = [];
    setOpacity(0);
    setCurrentSrc(fallback);

    if (!shouldLoad) return;

    const revealImage = () => {
      if (cancelled) return;

      setCurrentSrc(imageSrc);
      CLARITY_STEPS.forEach((step, index) => {
        const timer = window.setTimeout(() => {
          if (!cancelled) {
            setOpacity(step);
          }
        }, index * 90);
        revealTimersRef.current.push(timer);
      });
    };

    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = priority ? "high" : "auto";
    if (srcSet) {
      image.srcset = srcSet;
      image.sizes = sizes || PURPOSE_SIZES[purpose];
    }
    image.src = imageSrc;

    if (image.complete && image.naturalWidth > 0) {
      revealImage();
    } else if (typeof image.decode === "function") {
      image.decode().then(revealImage).catch(() => {
        if (!cancelled) {
          setCurrentSrc(fallback);
          setOpacity(1);
        }
      });
    } else {
      image.onload = revealImage;
      image.onerror = () => {
        if (!cancelled) {
          setCurrentSrc(fallback);
          setOpacity(1);
        }
      };
    }

    return () => {
      cancelled = true;
      revealTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      revealTimersRef.current = [];
    };
  }, [fallback, imageSrc, priority, purpose, shouldLoad, sizes, srcSet]);

  return (
    <img
      src={currentSrc}
      srcSet={currentSrc === imageSrc ? srcSet : undefined}
      ref={setRefs}
      alt={alt}
      sizes={sizes || PURPOSE_SIZES[purpose]}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn(
        "bg-muted",
        className
      )}
      style={{ ...style, opacity }}
      onLoad={(event) => {
        onLoad?.(event);
      }}
      onError={(event) => {
        if (currentSrc !== fallback) {
          setCurrentSrc(fallback);
          setOpacity(1);
        }
        onError?.(event);
      }}
      {...props}
    />
  );
});

StorefrontImage.displayName = "StorefrontImage";

export default StorefrontImage;
