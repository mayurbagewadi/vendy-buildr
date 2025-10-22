import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from "lucide-react";

interface StoreFooterProps {
  storeName: string;
  storeDescription?: string | null;
  whatsappNumber?: string | null;
}

const StoreFooter = ({ storeName, storeDescription, whatsappNumber }: StoreFooterProps) => {
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
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Terms & Conditions
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Return Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Shipping Policy
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-foreground mb-4">Contact Us</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {whatsappNumber && (
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span>{whatsappNumber}</span>
                </li>
              )}
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>Contact us for inquiries</span>
              </li>
            </ul>
            <div className="flex gap-3 mt-4">
              <a
                href="#"
                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Twitter className="w-4 h-4" />
              </a>
            </div>
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
