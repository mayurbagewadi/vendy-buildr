import { useState, useEffect } from "react";
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
  const [convertedBanners, setConvertedBanners] = useState<string[]>([]);

  useEffect(() => {
    // Convert all banner URLs on mount
    const converted = bannerUrls
      .map(url => convertToDirectImageUrl(url) || url)
      .filter(Boolean);
    setConvertedBanners(converted);
  }, [bannerUrls]);

  // If no banners, show gradient fallback
  if (!convertedBanners.length) {
    return (
      <section className="bg-gradient-to-r from-primary/10 via-primary/5 to-background py-32">
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
            {storeDescription && (
              <p className="text-xl text-muted-foreground">
                {storeDescription}
              </p>
            )}
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
              <div className="relative h-[300px] md:h-[380px] lg:h-[450px]">
                {/* Banner Image */}
                <LazyImage 
                  src={bannerUrl} 
                  alt={generateStoreImageAlt({
                    storeName,
                    imageType: 'banner',
                    description: storeDescription || undefined
                  })}
                  className="absolute inset-0 w-full h-full object-fill"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        
        {/* Navigation Arrows - Only show if multiple banners */}
        {convertedBanners.length > 1 && (
          <>
            <CarouselPrevious className="left-4 bg-white/20 border-white/30 text-white hover:bg-white/30" />
            <CarouselNext className="right-4 bg-white/20 border-white/30 text-white hover:bg-white/30" />
          </>
        )}
      </Carousel>
    </section>
  );
};

export default HeroBannerCarousel;
