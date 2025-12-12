import { Link } from 'react-router-dom';
import { Store, ShoppingCart, Grid3x3, Info, HelpCircle, FileText, Shield } from 'lucide-react';

interface FooterSitemapProps {
  storeSlug?: string;
}

export default function FooterSitemap({ storeSlug }: FooterSitemapProps) {
  // Build links based on whether this is a store page or main platform
  const basePath = storeSlug ? `/${storeSlug}` : '';

  return (
    <footer className="bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Shop Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center">
              <Store className="h-4 w-4 mr-2" />
              Shop
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to={basePath || '/'}
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to={`${basePath}/products`}
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  All Products
                </Link>
              </li>
              <li>
                <Link
                  to={`${basePath}/categories`}
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  Categories
                </Link>
              </li>
              <li>
                <Link
                  to={`${basePath}/cart`}
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  Shopping Cart
                </Link>
              </li>
            </ul>
          </div>

          {/* Help & Support Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center">
              <HelpCircle className="h-4 w-4 mr-2" />
              Help & Support
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to={`${basePath}/policies`}
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  Store Policies
                </Link>
              </li>
              <li>
                <a
                  href="#contact"
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  Contact Us
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  FAQ
                </a>
              </li>
              <li>
                <a
                  href="#shipping"
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  Shipping Info
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Legal
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/privacy-policy"
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms-of-service"
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="#refund"
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  Refund Policy
                </a>
              </li>
              <li>
                <a
                  href="#cookies"
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  Cookie Policy
                </a>
              </li>
            </ul>
          </div>

          {/* About Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center">
              <Info className="h-4 w-4 mr-2" />
              About
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="#about"
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  href="#mission"
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  Our Mission
                </a>
              </li>
              <li>
                <a
                  href="#quality"
                  className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  Quality Guarantee
                </a>
              </li>
              {!storeSlug && (
                <li>
                  <Link
                    to="/become-helper"
                    className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                  >
                    Become a Helper
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              © {new Date().getFullYear()} {storeSlug ? 'All Rights Reserved' : 'YesGive. All Rights Reserved'}
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link
                to="/sitemap.xml"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
              >
                Sitemap
              </Link>
              <a
                href="#accessibility"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
              >
                Accessibility
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
