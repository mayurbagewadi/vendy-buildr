import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, User, Phone, Mail, Package, Calendar, Clock } from "lucide-react";

interface OrderItem {
  productId: string;
  productName: string;
  variant?: string;
  price: number;
  quantity: number;
  productImage?: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  delivery_address: string;
  delivery_landmark?: string;
  delivery_pincode?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  delivery_time?: string;
  items: OrderItem[];
  subtotal: number;
  delivery_charge: number;
  total: number;
  status: string;
  payment_method: string;
  notes?: string;
  created_at: string;
}

interface OrderDetailModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}

export function OrderDetailModal({ order, open, onClose }: OrderDetailModalProps) {
  if (!order) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Details - {order.order_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Information */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Information
            </h3>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{order.customer_name}</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{order.customer_phone}</span>
              </p>
              {order.customer_email && (
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{order.customer_email}</span>
                </p>
              )}
            </div>
          </div>

          {/* Delivery Information */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Delivery Information
            </h3>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p><strong>Address:</strong> {order.delivery_address}</p>
              {order.delivery_landmark && (
                <p><strong>Landmark:</strong> {order.delivery_landmark}</p>
              )}
              {order.delivery_pincode && (
                <p><strong>PIN Code:</strong> {order.delivery_pincode}</p>
              )}
              {order.delivery_time && (
                <p><strong>Delivery Time:</strong> {order.delivery_time}</p>
              )}
              {order.delivery_latitude && order.delivery_longitude && (
                <p>
                  <strong>Location:</strong>{" "}
                  <a
                    href={`https://www.google.com/maps?q=${order.delivery_latitude},${order.delivery_longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View on Map
                  </a>
                </p>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Order Items
            </h3>
            <div className="space-y-3">
              {Array.isArray(order.items) && order.items.map((item, index) => (
                <div key={index} className="flex gap-3 p-3 bg-muted rounded-lg">
                  {item.productImage && (
                    <img
                      src={item.productImage}
                      alt={item.productName}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{item.productName}</p>
                    {item.variant && (
                      <p className="text-sm text-muted-foreground">{item.variant}</p>
                    )}
                    <p className="text-sm">
                      {formatCurrency(item.price)} × {item.quantity} = {formatCurrency(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <h3 className="font-semibold mb-3">Order Summary</h3>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Charge:</span>
                <span>{order.delivery_charge > 0 ? formatCurrency(order.delivery_charge) : "FREE"}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span className="text-primary">{formatCurrency(order.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Payment Method:</span>
                <Badge variant="outline">{order.payment_method.toUpperCase()}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Status:</span>
                <Badge>{order.status}</Badge>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          {order.notes && (
            <div>
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="bg-muted p-3 rounded-lg">{order.notes}</p>
            </div>
          )}

          {/* Order Timeline */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Order Timeline
            </h3>
            <div className="bg-muted p-4 rounded-lg">
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Placed on {formatDate(order.created_at)} at {formatTime(order.created_at)}</span>
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
