import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  delivery_address: string;
  delivery_landmark?: string;
  delivery_pincode?: string;
  delivery_time?: string;
  status: string;
  payment_method: string;
  notes?: string;
}

interface EditOrderModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onSave: (orderId: string, updates: Partial<Order>) => Promise<void>;
}

export function EditOrderModal({ order, open, onClose, onSave }: EditOrderModalProps) {
  const [formData, setFormData] = useState<Partial<Order>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setFormData({
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        delivery_address: order.delivery_address,
        delivery_landmark: order.delivery_landmark,
        delivery_pincode: order.delivery_pincode,
        delivery_time: order.delivery_time,
        status: order.status,
        payment_method: order.payment_method,
        notes: order.notes,
      });
    }
  }, [order]);

  if (!order) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(order.id, formData);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order - {order.order_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer Information */}
          <div className="space-y-2">
            <Label htmlFor="customer_name">Customer Name</Label>
            <Input
              id="customer_name"
              value={formData.customer_name || ""}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_phone">Phone</Label>
              <Input
                id="customer_phone"
                value={formData.customer_phone || ""}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_email">Email (Optional)</Label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email || ""}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
              />
            </div>
          </div>

          {/* Delivery Information */}
          <div className="space-y-2">
            <Label htmlFor="delivery_address">Delivery Address</Label>
            <Textarea
              id="delivery_address"
              value={formData.delivery_address || ""}
              onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delivery_landmark">Landmark (Optional)</Label>
              <Input
                id="delivery_landmark"
                value={formData.delivery_landmark || ""}
                onChange={(e) => setFormData({ ...formData, delivery_landmark: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_pincode">PIN Code</Label>
              <Input
                id="delivery_pincode"
                value={formData.delivery_pincode || ""}
                onChange={(e) => setFormData({ ...formData, delivery_pincode: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_time">Delivery Time</Label>
            <Input
              id="delivery_time"
              value={formData.delivery_time || ""}
              onChange={(e) => setFormData({ ...formData, delivery_time: e.target.value })}
            />
          </div>

          {/* Order Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Order Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cod">Cash on Delivery</SelectItem>
                  <SelectItem value="online">Online Payment</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Add any additional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
