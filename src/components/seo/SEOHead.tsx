// Dynamic SEO Head Component for Meta Tags
import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  type?: 'website' | 'product' | 'article';
  keywords?: string[];
  author?: string;
  price?: number;
  currency?: string;
  availability?: 'in stock' | 'out of stock';
}

/**
 * SEO Head Component - Manages all meta tags for SEO
 * Use this on every customer-facing page for optimal SEO
 */
export function SEOHead({
  title,
  description,
  canonical,
  image = 'https://yesgive.shop/placeholder.svg',
  type = 'website',
  keywords = [],
  author,
  price,
  currency = 'INR',
  availability,
}: SEOHeadProps) {
  // Ensure description is within limits
  const metaDescription = description.slice(0, 160);
  const metaTitle = title.slice(0, 60);

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{metaTitle}</title>
      <meta name="title" content={metaTitle} />
      <meta name="description" content={metaDescription} />
      {keywords.length > 0 && <meta name="keywords" content={keywords.join(', ')} />}
      {author && <meta name="author" content={author} />}

      {/* Favicon - Use store logo or default YesGive logo */}
      <link rel="icon" type="image/png" href={image} />
      <link rel="apple-touch-icon" href={image} />

      {/* Canonical URL */}
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={image} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:site_name" content="YesGive Shop" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={image} />

      {/* Product-specific meta tags */}
      {type === 'product' && price && (
        <>
          <meta property="product:price:amount" content={price.toString()} />
          <meta property="product:price:currency" content={currency} />
          {availability && (
            <meta
              property="product:availability"
              content={availability === 'in stock' ? 'in stock' : 'out of stock'}
            />
          )}
        </>
      )}

      {/* Mobile Optimization */}
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      <meta name="theme-color" content="#000000" />

      {/* Performance hints */}
      <link rel="preconnect" href="https://vexeuxsvckpfvuxqchqu.supabase.co" />
    </Helmet>
  );
}
