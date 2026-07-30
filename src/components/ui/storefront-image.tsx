import LazyImage from "@/components/ui/lazy-image";

type StorefrontImageProps = React.ComponentProps<typeof LazyImage> & {
  purpose?: "hero-banner" | "product-card" | "category-card" | "content-image";
};

const StorefrontImage = ({ purpose: _purpose, ...props }: StorefrontImageProps) => {
  return <LazyImage {...props} />;
};

export default StorefrontImage;
