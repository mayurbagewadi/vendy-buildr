import { useState } from "react";
import { convertToDirectImageUrl } from "@/lib/imageUtils";
import { generateStoreImageAlt } from "@/lib/seo/altTags";
import LazyImage from "@/components/ui/lazy-image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

interface HeroBannerCarouselProps {
  bannerUrls: string[];
  storeName: string;
  logoUrl?: string | null;
  storeDescription?: string | null;
}

const HeroBannerCarousel = ({ 
  bannerUrls, 
  storeName, 
  logoUrl, 
  storeDescription 
}: HeroBannerCarouselProps) => {
  const [loadedBanners, setLoadedBanners] = useState<Record<number, boolean>>({});

  // Compute synchronously so the first render already has banner URLs —
  // this lets the browser preload scanner see fetchPriority="high" immediately
  const convertedBanners = bannerUrls
    .map(url => convertToDirectImageUrl(url) || url)
    .filter(Boolean);

  const markBannerLoaded = (index: number) => {
    setLoadedBanners(prev => ({ ...prev, [index]: true }));
  };

  // If no banners, show gradient fallback
  if (!convertedBanners.length) {
    return (
      <section className="bg-gradient-to-r from-primary/10 via-accent/5 to-background py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            {logoUrl && (
              <img 
                src={convertToDirectImageUrl(logoUrl) || logoUrl} 
                alt={storeName}
                className="h-24 w-24 mx-auto mb-6 rounded-full object-cover border-4 border-background shadow-lg"
              />
            )}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              {storeName}
            </h1>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative">
      <Carousel
        className="w-full"
        plugins={[
          Autoplay({
            delay: 4000,
            stopOnInteraction: false,
          }),
        ]}
        opts={{
          loop: true,
        }}
      >
        <CarouselContent>
          {convertedBanners.map((bannerUrl, index) => (
            <CarouselItem key={index}>
              <div className="relative h-[300px] md:h-[380px] lg:h-[450px] overflow-hidden bg-muted">
                {!loadedBanners[index] && (
                  <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted/70 to-muted" />
                )}
                {index === 0 ? (
                  // First banner is LCP element — load eagerly with high priority
                  <img
                    src={bannerUrl}
                    alt={generateStoreImageAlt({
                      storeName,
                      imageType: 'banner',
                      description: storeDescription || undefined
                    })}
                    className={`absolute inset-0 w-full h-full object-fill transition-opacity duration-500 ${
                      loadedBanners[index] ? "opacity-100" : "opacity-0"
                    }`}
                    loading="eager"
                    decoding="async"
                    fetchpriority="high"
                    onLoad={(e) => {
                      const image = e.currentTarget;
                      if (image.decode) {
                        image.decode().catch(() => undefined).finally(() => markBannerLoaded(index));
                        return;
                      }
                      markBannerLoaded(index);
                    }}
                    onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                  />
                ) : (
                  <LazyImage
                    src={bannerUrl}
                    alt={generateStoreImageAlt({
                      storeName,
                      imageType: 'banner',
                      description: storeDescription || undefined
                    })}
                    className="absolute inset-0 w-full h-full object-fill"
                    priority={index === 1}
                    preloadMargin="1200px 0px"
                    onLoad={() => markBannerLoaded(index)}
                  />
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        
        {/* Navigation Arrows - Only show if multiple banners */}
        {convertedBanners.length > 1 && (
          <>
            <CarouselPrevious className="left-4 bg-card/20 border-border/30 text-card-foreground hover:bg-card/40" />
            <CarouselNext className="right-4 bg-card/20 border-border/30 text-card-foreground hover:bg-card/40" />
          </>
        )}
      </Carousel>
    </section>
  );
};

export default HeroBannerCarousel;
