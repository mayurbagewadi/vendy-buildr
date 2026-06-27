import { isStoreSpecificDomain } from "@/lib/domainUtils";

type ProductIdentifier = {
  id: string;
  slug?: string | null;
};

export type StorefrontUrlsOptions = {
  slug?: string | null;
  isStoreSpecific?: boolean;
};

export const buildStorefrontUrls = ({
  slug,
  isStoreSpecific = isStoreSpecificDomain(),
}: StorefrontUrlsOptions) => {
  const storePath = slug ? `/${slug}` : "";
  const base = isStoreSpecific ? "" : storePath;
  const path = (suffix = "") => `${base}${suffix}` || "/";

  return {
    home: path(),
    products: path("/products"),
    categories: path("/categories"),
    about: path("/about"),
    cart: path("/cart"),
    checkout: path("/checkout"),
    paymentSuccess: path("/payment-success"),
    product: (product: ProductIdentifier) => {
      const productIdentifier = product.slug || product.id;
      return path(`/products/${productIdentifier}`);
    },
  };
};
