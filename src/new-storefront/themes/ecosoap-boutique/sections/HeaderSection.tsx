import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Leaf, Phone, ShoppingBag } from "lucide-react";
import EcoSoapCartDrawer from "@/components/themes/ecosoap/EcoSoapCartDrawer";
import type { CartItem } from "@/lib/cartUtils";

const ThemeToggle = lazy(() =>
  import("@/components/ui/theme-toggle").then((module) => ({
    default: module.ThemeToggle,
  }))
);

type HeaderStore = {
  id: string;
  name: string;
};

type HeaderNavItem = {
  href: string;
  label: string;
  active: boolean;
  activeClass: string;
  icon: LucideIcon | null;
  iconClass: string;
};

type HeaderCopy = {
  headerBadge: string;
  headerTrust: string;
};

type HeaderSectionProps = {
  store: HeaderStore;
  homeLink: string;
  cartLink: string;
  checkoutLink: string;
  navItems: HeaderNavItem[];
  copy: HeaderCopy;
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  order: number;
  onWhatsApp: () => void;
  updateCartQuantity: (productId: string, variant: string | undefined, quantity: number) => void;
  removeCartItem: (productId: string, variant?: string) => void;
};

const HeaderSection = ({
  store,
  homeLink,
  cartLink,
  checkoutLink,
  navItems,
  copy,
  cart,
  cartCount,
  cartTotal,
  order,
  onWhatsApp,
  updateCartQuantity,
  removeCartItem,
}: HeaderSectionProps) => {
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  return (
    <div style={{ order }}>
      <header className="sticky top-0 z-40 w-full border-b border-stone-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <Link to={homeLink} className="group flex items-center gap-2.5 text-left">
              <span className="rounded-full bg-emerald-50 p-2.5 text-emerald-700 transition-transform duration-300 group-hover:rotate-12">
                <Leaf className="h-6 w-6 stroke-[2.2]" />
              </span>
              <span>
                <span className="font-serif text-2xl font-semibold tracking-normal text-stone-900">
                  {store.name || "EcoSoap"}
                </span>
                <span className="-mt-1 block text-[10px] font-semibold uppercase tracking-widest text-emerald-800">
                  {copy.headerBadge}
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
                      ? item.activeClass
                      : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                  }`}
                >
                  {item.icon && <item.icon className={`h-4 w-4 ${item.iconClass}`} />}
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <button
                onClick={onWhatsApp}
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
                <span className="text-[10px] font-medium uppercase tracking-normal text-emerald-800">{copy.headerTrust}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <EcoSoapCartDrawer
        isOpen={isCartDrawerOpen}
        cart={cart}
        cartTotal={cartTotal}
        cartLink={cartLink}
        checkoutLink={checkoutLink}
        onClose={() => setIsCartDrawerOpen(false)}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeCartItem}
      />
    </div>
  );
};

export default HeaderSection;
