import { Facebook, Instagram, Twitter, Youtube, Linkedin, Mail, Phone, MapPin } from "lucide-react";
import { Link, useParams } from "react-router-dom";

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
  const policiesPath = slug ? `/${slug}/policies` : "/policies";
  const basePath = slug ? `/${slug}` : '';

  /**
   * Enterprise Pattern: Fallback Chain for Social URLs
   * Priority: Dedicated field → Legacy socialLinks → null
   */
  const resolvedSocial = {
    facebook: facebookUrl || socialLinks?.facebook || null,
    instagram: instagramUrl || socialLinks?.instagram || null,
    twitter: twitterUrl || socialLinks?.twitter || null,
    youtube: youtubeUrl || null,
    linkedin: linkedinUrl || null,
  };

  const hasSocialLinks = Object.values(resolvedSocial).some(url => url);

  return (
    <footer data-ai="section-footer" className="bg-muted border-t border-border">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About Store */}
          <div>
            <h3 className="font-bold text-foreground mb-4">About {storeName}</h3>
            <p className="text-muted-foreground text-sm">
              {storeDescription || "Your trusted online store for quality products at great prices."}
            </p>
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
                <Link
                  to="/sitemap.xml"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Sitemap
                </Link>
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
                  <Phone className="w-4 h-4 flex-shrink-0" />
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
                  <span>{address}</span>
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
          <p>&copy; {new Date().getFullYear()} {storeName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default StoreFooter;
