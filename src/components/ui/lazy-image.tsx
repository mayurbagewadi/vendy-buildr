import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { convertToDirectImageUrl } from "@/lib/imageUtils";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
  priority?: boolean;
  preloadMargin?: string;
}

const LazyImage = ({
  src,
  alt,
  className,
  fallback = "/placeholder.svg",
  priority = false,
  preloadMargin = "900px 0px",
  ...props
}: LazyImageProps) => {
  const directSrc = convertToDirectImageUrl(src) || src;
  const [imageSrc, setImageSrc] = useState<string>(priority ? directSrc : fallback);
  const [isLoading, setIsLoading] = useState(!priority);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority) {
      setImageSrc(directSrc);
      setIsLoading(false);
      setIsInView(true);
      return;
    }

    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: preloadMargin,
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [directSrc, fallback, preloadMargin, priority]);

  useEffect(() => {
    if (!isInView) return;
    if (priority) return;

    const img = new Image();
    img.src = directSrc;
    
    img.onload = () => {
      setImageSrc(directSrc);
      setIsLoading(false);
    };

    img.onerror = () => {
      setImageSrc(fallback);
      setIsLoading(false);
    };
  }, [directSrc, isInView, fallback]);

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={cn(
        "transition-opacity duration-300",
        isLoading ? "opacity-50" : "opacity-100",
        className
      )}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...props}
    />
  );
};

export default LazyImage;
