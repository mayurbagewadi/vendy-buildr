export type ImageVariantKey = "thumb" | "card" | "mobile" | "detail" | "zoom";

export type ResponsiveImageVariants = Partial<Record<ImageVariantKey, string>>;

export interface ResponsiveImage {
  url?: string;
  original?: string;
  variants?: ResponsiveImageVariants;
  width?: number;
  height?: number;
  format?: string;
}

export type StorefrontImageSource = string | ResponsiveImage | null | undefined;

const SRCSET_ORDER: ImageVariantKey[] = ["thumb", "card", "mobile", "detail", "zoom"];

const VARIANT_WIDTHS: Record<ImageVariantKey, number> = {
  thumb: 160,
  card: 480,
  mobile: 768,
  detail: 1200,
  zoom: 1600,
};

export const isResponsiveImage = (image: StorefrontImageSource): image is ResponsiveImage => {
  return Boolean(image && typeof image === "object" && ("variants" in image || "url" in image || "original" in image));
};

export const getImageUrl = (image: StorefrontImageSource, fallback = "/placeholder.svg"): string => {
  if (!image) return fallback;
  if (typeof image === "string") return image || fallback;

  return image.variants?.detail
    || image.variants?.card
    || image.variants?.mobile
    || image.variants?.thumb
    || image.url
    || image.original
    || fallback;
};

export const getImageSrcSet = (image: StorefrontImageSource): string | undefined => {
  if (!isResponsiveImage(image) || !image.variants) return undefined;

  const srcSet = SRCSET_ORDER
    .map((key) => {
      const url = image.variants?.[key];
      return url ? `${url} ${VARIANT_WIDTHS[key]}w` : null;
    })
    .filter(Boolean)
    .join(", ");

  return srcSet || undefined;
};

export const normalizeUploadedImage = (responseData: any): StorefrontImageSource => {
  if (responseData?.image && typeof responseData.image === "object") {
    return responseData.image as ResponsiveImage;
  }

  return responseData?.imageUrl || null;
};
