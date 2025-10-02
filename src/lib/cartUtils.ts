// Shopping cart utilities and types

export interface CartItem {
  productId: string;
  productName: string;
  productImage: string;
  variant?: string;
  price: number;
  quantity: number;
  sku?: string;
}

const CART_STORAGE_KEY = 'shopping_cart';

// Get cart from localStorage
export const getCart = (): CartItem[] => {
  const cart = localStorage.getItem(CART_STORAGE_KEY);
  return cart ? JSON.parse(cart) : [];
};

// Save cart to localStorage
export const saveCart = (cart: CartItem[]): void => {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
};

// Add item to cart
export const addToCart = (item: CartItem): CartItem[] => {
  const cart = getCart();
  const existingItemIndex = cart.findIndex(
    (i) => i.productId === item.productId && i.variant === item.variant
  );

  if (existingItemIndex > -1) {
    cart[existingItemIndex].quantity += item.quantity;
  } else {
    cart.push(item);
  }

  saveCart(cart);
  return cart;
};

// Update item quantity
export const updateCartItemQuantity = (
  productId: string,
  variant: string | undefined,
  quantity: number
): CartItem[] => {
  const cart = getCart();
  const itemIndex = cart.findIndex(
    (i) => i.productId === productId && i.variant === variant
  );

  if (itemIndex > -1) {
    if (quantity <= 0) {
      cart.splice(itemIndex, 1);
    } else {
      cart[itemIndex].quantity = quantity;
    }
  }

  saveCart(cart);
  return cart;
};

// Remove item from cart
export const removeFromCart = (productId: string, variant?: string): CartItem[] => {
  const cart = getCart().filter(
    (item) => !(item.productId === productId && item.variant === variant)
  );
  saveCart(cart);
  return cart;
};

// Clear cart
export const clearCart = (): void => {
  localStorage.removeItem(CART_STORAGE_KEY);
};

// Get cart total
export const getCartTotal = (cart: CartItem[]): number => {
  return cart.reduce((total, item) => total + item.price * item.quantity, 0);
};

// Get cart item count
export const getCartItemCount = (cart: CartItem[]): number => {
  return cart.reduce((count, item) => count + item.quantity, 0);
};
