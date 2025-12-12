// SEO Schema Types (Schema.org)

export interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  basePrice?: number;
  base_price?: number;
  priceRange?: string;
  price_range?: string;
  sku?: string;
  baseSku?: string;
  category?: string;
  status?: string;
  variants?: Array<{
    name: string;
    price: number;
    sku?: string;
  }>;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  address?: string | null;
  whatsapp_number?: string | null;
  subdomain?: string | null;
  custom_domain?: string | null;
  social_links?: {
    facebook?: string | null;
    instagram?: string | null;
    twitter?: string | null;
  } | null;
}

export interface ProductSchemaProps {
  product: Product;
  store: Store;
  url: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder' | 'LimitedAvailability';
}

export interface OrganizationSchemaProps {
  store: Store;
  url: string;
  email?: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
}

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}
