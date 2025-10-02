import { Link } from "react-router-dom";
import Header from "@/components/customer/Header";
import Footer from "@/components/customer/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Minus, Plus, X, ShoppingBag, ChevronRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

const Cart = () => {
  const { cart, cartTotal, updateQuantity, removeItem } = useCart();

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <ShoppingBag className="w-24 h-24 mx-auto mb-6 text-muted-foreground" />
            <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
            <p className="text-muted-foreground mb-8">
              Add some products to your cart to see them here
            </p>
            <Link to="/products">
              <Button size="lg">Continue Shopping</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/home" className="hover:text-foreground">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">Shopping Cart</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <h1 className="text-3xl font-bold mb-6">Shopping Cart</h1>
            <div className="space-y-4">
              {cart.map((item) => (
                <Card key={`${item.productId}-${item.variant}`}>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-lg"
                      />

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-lg">{item.productName}</h3>
                            {item.variant && (
                              <p className="text-sm text-muted-foreground">
                                Variant: {item.variant}
                              </p>
                            )}
                            {item.sku && (
                              <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.productId, item.variant)}
                          >
                            <X className="w-5 h-5" />
                          </Button>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
                          {/* Quantity Controls */}
                          <div className="flex items-center border border-border rounded-lg w-fit">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  item.variant,
                                  item.quantity - 1
                                )
                              }
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-12 text-center font-semibold">
                              {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  item.variant,
                                  item.quantity + 1
                                )
                              }
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* Price */}
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              ₹{item.price} each
                            </p>
                            <p className="text-xl font-bold text-primary">
                              ₹{item.price * item.quantity}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">Order Summary</h2>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
                    <span>₹{cartTotal}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery</span>
                    <span className="text-success">FREE</span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between items-center">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">₹{cartTotal}</span>
                  </div>
                </div>

                <Link to="/checkout" className="block mb-3">
                  <Button className="w-full" size="lg">
                    Proceed to Checkout
                  </Button>
                </Link>
                <Link to="/products">
                  <Button variant="outline" className="w-full">
                    Continue Shopping
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Cart;
