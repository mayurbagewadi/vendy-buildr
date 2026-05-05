import { Facebook, Instagram, Twitter, Youtube, Linkedin, Mail, Phone, MapPin } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { isStoreSpecificDomain } from "@/lib/domainUtils";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const ensureHttps = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
};

/**
 * Enterprise Pattern: Social Media URL Props with Fallback Chain
 *
 * Priority: Dedicated URL fields (from Growth → Social Media)
 *           → Legacy socialLinks JSON (from Settings)
 *
 * This ensures backward compatibility while supporting the new dedicated fields.
 */
interface StoreFooterProps {
  storeName: string;
  storeDescription?: string | null;
  whatsappNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  // Dedicated social URL fields (Growth → Social Media) - PRIORITY
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  linkedinUrl?: string | null;
  // Legacy social links (Settings) - FALLBACK
  socialLinks?: {
    facebook?: string | null;
    instagram?: string | null;
    twitter?: string | null;
  } | null;
  policies?: {
    returnPolicy?: string | null;
    shippingPolicy?: string | null;
    termsConditions?: string | null;
    deliveryAreas?: string | null;
    privacyPolicy?: string | null;
  } | null;
}

const StoreFooter = ({
  storeName,
  storeDescription,
  whatsappNumber,
  phone,
  email,
  address,
  // Dedicated fields (priority)
  facebookUrl,
  instagramUrl,
  twitterUrl,
  youtubeUrl,
  linkedinUrl,
  // Legacy (fallback)
  socialLinks,
  policies
}: StoreFooterProps) => {
  const { slug } = useParams<{ slug: string }>();
  const isSubdomain = isStoreSpecificDomain();
  // On subdomain, basePath is always '' — the subdomain itself is the store context.
  // Never use useParams() slug on subdomain: on product detail pages the :slug param
  // is the product slug, not the store slug, which would build broken footer links.
  const routingSlug = isSubdomain ? undefined : slug;
  const policiesPath = routingSlug ? `/${routingSlug}/policies` : "/policies";
  const basePath = routingSlug ? `/${routingSlug}` : '';

  /**
   * Enterprise Pattern: Fallback Chain for Social URLs
   * Priority: Dedicated field → Legacy socialLinks → null
   */
  const resolvedSocial = {
    facebook: ensureHttps(facebookUrl || socialLinks?.facebook || null),
    instagram: ensureHttps(instagramUrl || socialLinks?.instagram || null),
    twitter: ensureHttps(twitterUrl || socialLinks?.twitter || null),
    youtube: ensureHttps(youtubeUrl || null),
    linkedin: ensureHttps(linkedinUrl || null),
  };

  const hasSocialLinks = Object.values(resolvedSocial).some(url => url);

  return (
    <footer data-ai="section-footer" className="bg-muted border-t border-border">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About Store */}
          <div>
            <h3 className="font-bold text-foreground mb-4">About {storeName}</h3>
            {(() => {
              const text = storeDescription || "Your trusted online store for quality products at great prices.";
              const LIMIT = 120;
              const isTruncated = storeDescription && storeDescription.length > LIMIT;
              return (
                <>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {isTruncated ? text.slice(0, LIMIT).trimEnd() + "…" : text}
                  </p>
                  {isTruncated && (
                    <Link
                      to={`${basePath}/about`}
                      className="text-primary text-sm hover:underline mt-2 inline-block"
                    >
                      Read more
                    </Link>
                  )}
                </>
              );
            })()}
          </div>

          {/* Shop Links */}
          <div>
            <h3 className="font-bold text-foreground mb-4">Shop</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to={basePath || '/'}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to={`${basePath}/products`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  All Products
                </Link>
              </li>
              <li>
                <Link
                  to={`${basePath}/categories`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Categories
                </Link>
              </li>
              <li>
                <Link
                  to={`${basePath}/cart`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Shopping Cart
                </Link>
              </li>
              <li>
                <a
                  href="/sitemap.xml"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Sitemap
                </a>
              </li>
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h3 className="font-bold text-foreground mb-4">Policies</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link 
                  to={`${policiesPath}#terms`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link 
                  to={`${policiesPath}#return-policy`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Return Policy
                </Link>
              </li>
              <li>
                <Link
                  to={`${policiesPath}#shipping-policy`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Shipping Policy
                </Link>
              </li>
              <li>
                <Link
                  to={`${policiesPath}#privacy-policy`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-foreground mb-4">Contact Us</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {phone && (
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span>{phone}</span>
                </li>
              )}
              {whatsappNumber && phone !== whatsappNumber && (
                <li className="flex items-center gap-2">
                  <WhatsAppIcon className="w-4 h-4 flex-shrink-0" />
                  <span>WhatsApp: {whatsappNumber}</span>
                </li>
              )}
              {email && (
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span>{email}</span>
                </li>
              )}
              {address && (
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="whitespace-pre-wrap break-words min-w-0">{address}</span>
                </li>
              )}
            </ul>
            {hasSocialLinks && (
              <div className="flex gap-3 mt-4">
                {resolvedSocial.facebook && (
                  <a
                    href={resolvedSocial.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="Facebook"
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {resolvedSocial.instagram && (
                  <a
                    href={resolvedSocial.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="Instagram"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {resolvedSocial.twitter && (
                  <a
                    href={resolvedSocial.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="Twitter"
                  >
                    <Twitter className="w-4 h-4" />
                  </a>
                )}
                {resolvedSocial.youtube && (
                  <a
                    href={resolvedSocial.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="YouTube"
                  >
                    <Youtube className="w-4 h-4" />
                  </a>
                )}
                {resolvedSocial.linkedin && (
                  <a
                    href={resolvedSocial.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="LinkedIn"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border mt-4 pt-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} DigitalDukandar.in. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default StoreFooter;
