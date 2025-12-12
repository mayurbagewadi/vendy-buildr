import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem, getCart, addToCart as addToCartUtil, updateCartItemQuantity, removeFromCart, clearCart, getCartTotal, getCartItemCount } from '@/lib/cartUtils';
import FlyingImage, { FlyAnimationState } from '@/components/customer/FlyingImage';

interface CartContextType {
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  addToCart: (item: CartItem) => void;
  updateQuantity: (productId: string, variant: string | undefined, quantity: number) => void;
  removeItem: (productId: string, variant?: string) => void;
  clearCart: () => void;
  triggerFlyAnimation: (imageSrc: string, sourceElement: HTMLElement) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [animationState, setAnimationState] = useState<FlyAnimationState | null>(null);

  useEffect(() => {
    setCart(getCart());
  }, []);

  const addToCart = (item: CartItem) => {
    const updatedCart = addToCartUtil(item);
    setCart(updatedCart);
  };

  const triggerFlyAnimation = (imageSrc: string, sourceElement: HTMLElement) => {
    // Get source image position
    const startRect = sourceElement.getBoundingClientRect();

    // Find the cart icon in the header
    const cartIcon = document.querySelector('[data-cart-icon]');
    if (!cartIcon) {
      console.warn('Cart icon not found for animation');
      return;
    }

    // Get cart icon position
    const endRect = cartIcon.getBoundingClientRect();

    // Trigger animation
    setAnimationState({
      imageSrc,
      startRect,
      endRect,
    });
  };

  const handleAnimationComplete = () => {
    setAnimationState(null);
  };

  const updateQuantity = (productId: string, variant: string | undefined, quantity: number) => {
    const updatedCart = updateCartItemQuantity(productId, variant, quantity);
    setCart(updatedCart);
  };

  const removeItem = (productId: string, variant?: string) => {
    const updatedCart = removeFromCart(productId, variant);
    setCart(updatedCart);
  };

  const handleClearCart = () => {
    clearCart();
    setCart([]);
  };

  const cartCount = getCartItemCount(cart);
  const cartTotal = getCartTotal(cart);

  return (
    <CartContext.Provider
      value={{
        cart,
        cartCount,
        cartTotal,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart: handleClearCart,
        triggerFlyAnimation,
      }}
    >
      {children}
      {animationState && (
        <FlyingImage
          animationState={animationState}
          onComplete={handleAnimationComplete}
        />
      )}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
