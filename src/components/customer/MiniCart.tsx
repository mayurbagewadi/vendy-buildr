import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import LazyImage from "@/components/ui/lazy-image";
import { supabase } from "@/integrations/supabase/client";

const MiniCart = () => {
  const { cart, cartCount, cartTotal, removeItem } = useCart();
  const [storeSlug, setStoreSlug] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Get store slug from cart items
    if (cart.length > 0 && cart[0].storeId) {
      const fetchStoreSlug = async () => {
        const { data } = await supabase
          .from("stores")
          .select("slug")
          .eq("id", cart[0].storeId)
          .maybeSingle();
        if (data) {
          setStoreSlug(data.slug);
        }
      };
      fetchStoreSlug();
    }
  }, [cart]);

  // Generate store-aware links
  const productsLink = storeSlug ? `/${storeSlug}/products` : "/products";
  const cartLink = storeSlug ? `/${storeSlug}/cart` : "/cart";
  const checkoutLink = storeSlug ? `/${storeSlug}/checkout` : "/checkout";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <ShoppingCart className="w-4 h-4" />
          {cartCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {cartCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-lg">Shopping Cart</h3>
          <p className="text-sm text-muted-foreground">{cartCount} items</p>
        </div>

        {cart.length === 0 ? (
          <div className="p-8 text-center">
            <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">Your cart is empty</p>
            <Link to={productsLink}>
              <Button variant="outline" className="w-full">
                Continue Shopping
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <ScrollArea className="h-80">
              <div className="p-4 space-y-4">
                {cart.map((item) => (
                  <Card key={`${item.productId}-${item.variant}`} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex gap-3">
                        <LazyImage
                          src={item.productImage}
                          alt={item.productName}
                          className="w-16 h-16 object-cover rounded flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{item.productName}</h4>
                          {item.variant && (
                            <p className="text-xs text-muted-foreground">{item.variant}</p>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm font-semibold text-primary">
                              ₹{item.price} × {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeItem(item.productId, item.variant)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total:</span>
                <span className="text-xl font-bold text-primary">₹{cartTotal}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link to={cartLink} className="w-full">
                  <Button variant="outline" className="w-full min-h-[44px]">
                    View Cart
                  </Button>
                </Link>
                <Link to={checkoutLink} className="w-full">
                  <Button className="w-full min-h-[44px]">Checkout</Button>
                </Link>
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default MiniCart;
