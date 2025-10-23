import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from "lucide-react";

interface StoreFooterProps {
  storeName: string;
  storeDescription?: string | null;
  whatsappNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
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
  } | null;
}

const StoreFooter = ({ storeName, storeDescription, whatsappNumber, phone, email, address, socialLinks, policies }: StoreFooterProps) => {
  return (
    <footer className="bg-muted border-t border-border mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Store */}
          <div>
            <h3 className="font-bold text-foreground mb-4">About {storeName}</h3>
            <p className="text-muted-foreground text-sm">
              {storeDescription || "Your trusted online store for quality products at great prices."}
            </p>
          </div>

          {/* Policies */}
          <div>
            <h3 className="font-bold text-foreground mb-4">Policies</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {policies?.termsConditions ? (
                <li>
                  <strong>Terms & Conditions:</strong><br />
                  <span className="line-clamp-2">{policies.termsConditions}</span>
                </li>
              ) : (
                <li>Terms & Conditions: Coming soon</li>
              )}
              {policies?.returnPolicy ? (
                <li>
                  <strong>Return Policy:</strong><br />
                  <span className="line-clamp-2">{policies.returnPolicy}</span>
                </li>
              ) : (
                <li>Return Policy: Coming soon</li>
              )}
              {policies?.shippingPolicy ? (
                <li>
                  <strong>Shipping Policy:</strong><br />
                  <span className="line-clamp-2">{policies.shippingPolicy}</span>
                </li>
              ) : (
                <li>Shipping Policy: Coming soon</li>
              )}
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
            {(socialLinks?.facebook || socialLinks?.instagram || socialLinks?.twitter) && (
              <div className="flex gap-3 mt-4">
                {socialLinks?.facebook && (
                  <a
                    href={socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {socialLinks?.instagram && (
                  <a
                    href={socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {socialLinks?.twitter && (
                  <a
                    href={socialLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Twitter className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {storeName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default StoreFooter;
