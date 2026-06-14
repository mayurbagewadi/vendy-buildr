import { lazy, Suspense, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Filter, HelpCircle, Leaf, Menu, Phone, ShoppingBag, X } from "lucide-react";

import EcoSoapCartDrawer from "@/components/themes/ecosoap/EcoSoapCartDrawer";
import { useCart } from "@/contexts/CartContext";
import { useStorefront } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { isStoreSpecificDomain } from "@/lib/domainUtils";
import { generateGeneralInquiryMessage, openWhatsApp } from "@/lib/whatsappUtils";

const ThemeToggle = lazy(() =>
  import("@/components/ui/theme-toggle").then((module) => ({
    default: module.ThemeToggle,
  }))
);

interface EcoSoapHeaderProps {
  storeSlug?: string;
  storeId?: string;
}

const EcoSoapHeader = ({ storeSlug: slugProp, storeId: idProp }: EcoSoapHeaderProps) => {
  const location = useLocation();
  const { store, storeSlug: ctxStoreSlug, storeId: ctxStoreId } = useStorefront();
  const { cart, cartCount, cartTotal, updateQuantity, removeItem } = useCart();
  const { toast } = useToast();
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSubdomain = isStoreSpecificDomain();
  const storeSlug = ctxStoreSlug ?? slugProp ?? store?.slug ?? "";
  const storeId = ctxStoreId ?? idProp ?? store?.id;
  const storeName = store?.name || "EcoSoap";

  const homeLink = isSubdomain ? "/" : `/${storeSlug}`;
  const productsLink = isSubdomain ? "/products" : `/${storeSlug}/products`;
  const categoriesLink = isSubdomain ? "/categories" : `/${storeSlug}/categories`;
  const aboutLink = isSubdomain ? "/about" : `/${storeSlug}/about`;
  const cartLink = isSubdomain ? "/cart" : `/${storeSlug}/cart`;
  const checkoutLink = isSubdomain ? "/checkout" : `/${storeSlug}/checkout`;

  const navItems = [
    { href: homeLink, label: "Home", active: location.pathname === homeLink, icon: null },
    { href: productsLink, label: "Products", active: location.pathname.startsWith(productsLink), icon: Leaf },
    { href: categoriesLink, label: "Categories", active: location.pathname.startsWith(categoriesLink), icon: Filter },
    { href: aboutLink, label: "About", active: location.pathname === aboutLink, icon: HelpCircle },
  ];

  const handleWhatsApp = async () => {
    const result = await openWhatsApp(generateGeneralInquiryMessage(), undefined, storeId);
    if (!result.success) {
      toast({
        title: "WhatsApp Not Configured",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-stone-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <Link to={homeLink} className="group flex items-center gap-2.5 text-left">
              <span className="rounded-full bg-emerald-50 p-2.5 text-emerald-700 transition-transform duration-300 group-hover:rotate-12">
                <Leaf className="h-6 w-6 stroke-[2.2]" />
              </span>
              <span>
                <span className="font-serif text-2xl font-semibold tracking-normal text-stone-900">
                  {storeName}
                </span>
                <span className="-mt-1 block text-[10px] font-semibold uppercase tracking-widest text-emerald-800">
                  Handcrafted Organic
                </span>
              </span>
            </Link>

            <nav className="hidden space-x-1 md:flex lg:space-x-2">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium tracking-wide transition-all ${
                    item.active
                      ? "border border-emerald-100 bg-emerald-50 text-emerald-800 shadow-sm"
                      : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                  }`}
                >
                  {item.icon && <item.icon className="h-4 w-4 text-emerald-600" />}
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <button
                onClick={handleWhatsApp}
                className="hidden rounded-full bg-stone-50 p-2.5 text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900 sm:inline-flex"
                aria-label="Contact on WhatsApp"
              >
                <Phone className="h-5 w-5 stroke-[2]" />
              </button>
              <Suspense
                fallback={
                  <span
                    aria-hidden="true"
                    className="inline-flex h-10 w-10 rounded-full border border-stone-100 bg-stone-50"
                  />
                }
              >
                <ThemeToggle
                  triggerClassName="h-10 w-10 rounded-full border-stone-100 bg-stone-50 text-stone-700 shadow-none hover:bg-stone-100 hover:text-stone-900 [&_svg]:text-stone-700"
                  contentClassName="rounded-2xl border-stone-100 bg-white p-2 text-stone-700 shadow-xl shadow-stone-200/60"
                  itemClassName="rounded-xl px-3 py-2 text-sm font-medium text-stone-700 focus:bg-emerald-50 focus:text-emerald-800"
                />
              </Suspense>
              <button
                onClick={() => setIsCartDrawerOpen(true)}
                className="relative rounded-full bg-stone-50 p-2.5 text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900"
                aria-label="Open shopping cart"
                data-cart-icon
              >
                <ShoppingBag className="h-5 w-5 stroke-[2]" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </button>
              <div className="hidden items-center gap-1.5 rounded-full border border-emerald-100/50 bg-emerald-50 px-3 py-1 lg:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-medium uppercase tracking-normal text-emerald-800">
                  100% Zero Plastic
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="rounded-full border border-stone-100 bg-stone-50 p-2.5 text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900 md:hidden"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5 animate-in spin-in-180 duration-300" />
                ) : (
                  <Menu className="h-5 w-5 animate-in fade-in duration-300" />
                )}
              </button>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-stone-100 bg-white/95 shadow-lg shadow-stone-200/40 animate-in slide-in-from-top-2 duration-300 md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 sm:px-6">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold tracking-wide transition-all ${
                    item.active
                      ? "border border-emerald-100 bg-emerald-50 text-emerald-800 shadow-sm"
                      : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                  }`}
                >
                  {item.icon && <item.icon className="h-4 w-4 text-emerald-600" />}
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleWhatsApp();
                }}
                className="mt-2 flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
              >
                <Phone className="h-4 w-4" />
                Contact on WhatsApp
              </button>
            </nav>
          </div>
        )}
      </header>

      <EcoSoapCartDrawer
        isOpen={isCartDrawerOpen}
        cart={cart}
        cartTotal={cartTotal}
        cartLink={cartLink}
        checkoutLink={checkoutLink}
        onClose={() => setIsCartDrawerOpen(false)}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
      />
    </>
  );
};

export default EcoSoapHeader;
