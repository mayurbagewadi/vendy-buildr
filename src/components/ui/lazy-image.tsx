import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { convertToDirectImageUrl } from "@/lib/imageUtils";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
}

const LazyImage = ({ src, alt, className, fallback = "/placeholder.svg", ...props }: LazyImageProps) => {
  const [imageSrc, setImageSrc] = useState<string>(fallback);
  const [isLoading, setIsLoading] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Convert Google Drive share links to direct image URLs
  const directSrc = convertToDirectImageUrl(src) || src;

  useEffect(() => {
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
        rootMargin: "50px",
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isInView) return;

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
      loading="lazy"
      {...props}
    />
  );
};

export default LazyImage;
