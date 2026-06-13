import { useEffect } from "react";
import { Minus, Plus, ShoppingBag, Ship, Trash2, X, Leaf } from "lucide-react";
import { Link } from "react-router-dom";
import type { CartItem } from "@/lib/cartUtils";

type EcoSoapCartDrawerProps = {
  isOpen: boolean;
  cart: CartItem[];
  cartTotal: number;
  cartLink: string;
  checkoutLink: string;
  onClose: () => void;
  onUpdateQuantity: (productId: string, variant: string | undefined, quantity: number) => void;
  onRemoveItem: (productId: string, variant?: string) => void;
};

const formatPrice = (value: number) => `Rs. ${Number(value || 0).toFixed(2)}`;

export default function EcoSoapCartDrawer({
  isOpen,
  cart,
  cartTotal,
  cartLink,
  checkoutLink,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
}: EcoSoapCartDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="EcoSoap shopping basket">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-stone-900/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-label="Close cart drawer"
      />

      <div className="absolute inset-y-0 right-0 flex max-w-full pl-8 sm:pl-10">
        <aside className="flex h-full w-screen max-w-md flex-col border-l border-stone-100 bg-white text-left shadow-2xl animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between border-b border-stone-100 p-6">
            <div>
              <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-stone-900">
                <ShoppingBag className="h-5 w-5 text-emerald-700" />
                Shopping Basket
              </h2>
              <p className="mt-1 text-xs text-stone-500">{cart.length} selected item{cart.length === 1 ? "" : "s"}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-900"
              aria-label="Close cart"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {cart.length === 0 ? (
              <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-stone-100 bg-stone-50">
                  <ShoppingBag className="h-8 w-8 text-stone-400" />
                </div>
                <h3 className="font-serif text-lg font-medium text-stone-800">Your Basket is Empty</h3>
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-stone-500">
                  Add handmade bars or botanical skincare blends to begin your EcoSoap checkout.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div
                    key={`${item.productId}-${item.variant || ""}`}
                    className="flex gap-4 rounded-xl border border-stone-100 bg-stone-50 p-3"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-white">
                      <img src={item.productImage} alt={item.productName} className="h-full w-full object-cover" loading="lazy" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-serif text-sm font-bold text-stone-900">{item.productName}</h4>
                      {item.variant && <p className="mt-0.5 text-xs text-stone-500">{item.variant}</p>}
                      <p className="mt-1 text-xs text-stone-500">{formatPrice(item.price)} each</p>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.productId, item.variant, item.quantity - 1)}
                          className="rounded border border-stone-200 bg-white p-1 text-stone-600 transition-colors hover:bg-stone-100"
                          aria-label={`Decrease ${item.productName} quantity`}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-6 text-center text-xs font-bold text-stone-800">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.productId, item.variant, item.quantity + 1)}
                          className="rounded border border-stone-200 bg-white p-1 text-stone-600 transition-colors hover:bg-stone-100"
                          aria-label={`Increase ${item.productName} quantity`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end justify-between">
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.productId, item.variant)}
                        className="p-1 text-stone-400 transition-colors hover:text-stone-800"
                        aria-label={`Remove ${item.productName}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <p className="text-sm font-semibold text-stone-900">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="space-y-4 border-t border-stone-100 bg-stone-50/70 p-6">
              <div className="space-y-2 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-stone-900">{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery, coupons, and stock</span>
                  <span className="font-bold text-emerald-700">Checked next</span>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-2 font-serif text-sm">
                  <span className="font-bold text-stone-800">Estimated total</span>
                  <span className="font-black text-stone-950">{formatPrice(cartTotal)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                <Leaf className="h-3.5 w-3.5 text-emerald-600" />
                <span>Secure checkout continues through the platform order engine.</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  to={cartLink}
                  onClick={onClose}
                  className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-stone-700 transition-colors hover:bg-stone-100"
                >
                  View Cart
                </Link>
                <Link
                  to={checkoutLink}
                  onClick={onClose}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-3 text-xs font-black uppercase tracking-wider text-white shadow transition-colors hover:bg-emerald-800"
                >
                  Checkout
                  <Ship className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
