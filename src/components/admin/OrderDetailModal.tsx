import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { MapPin, User, Phone, Mail, Package, Calendar, Clock, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  coupon_code?: string;
  discount_amount?: number;
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

  const getPaymentStatus = () => {
    const isCOD = order.payment_method.toLowerCase() === "cod" || order.payment_method.toLowerCase() === "cash on delivery";
    return {
      isCOD,
      label: isCOD ? "Pending Total:" : "Paid Total:",
      color: isCOD ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400",
    };
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    let yPosition = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - 2 * margin;

    // Helper to format currency for PDF (replace ₹ with Rs.)
    const formatCurrencyForPDF = (amount: number) => {
      return `Rs. ${amount.toFixed(2)}`;
    };

    // Helper to clean text for PDF (remove non-ASCII characters)
    const cleanTextForPDF = (text: string) => {
      if (!text) return "";
      // Remove non-ASCII characters (keeps only English letters, numbers, basic punctuation)
      return text
        .replace(/[^\x00-\x7F]/g, "") // Remove non-ASCII
        .replace(/^[\s\/]+/, "") // Remove leading slashes and spaces
        .replace(/[\s\/]+$/, "") // Remove trailing slashes and spaces
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .trim(); // Remove leading/trailing whitespace
    };

    // Title
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.text(`Order Details - ${order.order_number}`, margin, yPosition);
    yPosition += 12;

    // Customer Information
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("CUSTOMER INFORMATION", margin, yPosition);
    yPosition += 7;
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    doc.text(`Name: ${cleanTextForPDF(order.customer_name)}`, margin + 5, yPosition);
    yPosition += 5;
    doc.text(`Phone: ${order.customer_phone}`, margin + 5, yPosition);
    yPosition += 5;
    if (order.customer_email) {
      doc.text(`Email: ${order.customer_email}`, margin + 5, yPosition);
      yPosition += 5;
    }
    yPosition += 5;

    // Delivery Information
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("DELIVERY INFORMATION", margin, yPosition);
    yPosition += 7;
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    const addressLines = doc.splitTextToSize(`Address: ${cleanTextForPDF(order.delivery_address)}`, maxWidth - 10);
    doc.text(addressLines, margin + 5, yPosition);
    yPosition += addressLines.length * 5 + 3;

    if (order.delivery_landmark) {
      doc.text(`Landmark: ${cleanTextForPDF(order.delivery_landmark)}`, margin + 5, yPosition);
      yPosition += 5;
    }
    if (order.delivery_pincode) {
      doc.text(`PIN Code: ${order.delivery_pincode}`, margin + 5, yPosition);
      yPosition += 5;
    }
    if (order.delivery_time) {
      doc.text(`Delivery Time: ${cleanTextForPDF(order.delivery_time)}`, margin + 5, yPosition);
      yPosition += 5;
    }
    yPosition += 5;

    // Order Items Table
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("ORDER ITEMS", margin, yPosition);
    yPosition += 7;

    const itemsData = Array.isArray(order.items)
      ? order.items.map((item) => [
          cleanTextForPDF(item.productName),
          cleanTextForPDF(item.variant || "N/A"),
          formatCurrencyForPDF(item.price),
          item.quantity.toString(),
          formatCurrencyForPDF(item.price * item.quantity),
        ])
      : [];

    autoTable(doc, {
      head: [["Product Name", "Variant", "Price", "Qty", "Total"]],
      body: itemsData,
      startY: yPosition,
      margin: margin,
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25, halign: "right" },
        3: { cellWidth: 15, halign: "center" },
        4: { cellWidth: 25, halign: "right" },
      },
      headStyles: { fillColor: [66, 133, 244], textColor: 255, fontSize: 10 },
      bodyStyles: { textColor: 0, fontSize: 10 },
      alternateRowStyles: { fillColor: [240, 240, 240] },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Order Summary
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("ORDER SUMMARY", margin, yPosition);
    yPosition += 7;
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);

    const isCOD = order.payment_method.toLowerCase() === "cod" || order.payment_method.toLowerCase() === "cash on delivery";
    const totalLabel = isCOD ? "Pending Total:" : "Paid Total:";

    const summaryData = [
      ["Subtotal:", formatCurrencyForPDF(order.subtotal)],
      ["Delivery Charge:", order.delivery_charge > 0 ? formatCurrencyForPDF(order.delivery_charge) : "FREE"],
    ];

    // Add coupon and discount if available
    if (order.coupon_code) {
      summaryData.push(["Coupon Code:", order.coupon_code]);
    }
    if (order.discount_amount && order.discount_amount > 0) {
      summaryData.push(["Discount:", `-${formatCurrencyForPDF(order.discount_amount)}`]);
    }

    // Add total and payment method
    summaryData.push([totalLabel, formatCurrencyForPDF(order.total)]);
    summaryData.push(["Payment Method:", order.payment_method.toUpperCase()]);

    summaryData.forEach((row, index) => {
      // Label
      doc.setFont(undefined, "normal");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(row[0], margin + 5, yPosition);

      // Value - check for special coloring
      const isDiscountRow = row[1].includes("-Rs.");
      const isTotalRow = row[0].includes("Total:");

      if (isDiscountRow) {
        doc.setTextColor(220, 38, 38); // Red for discount
        doc.setFont(undefined, "bold");
      } else if (isTotalRow) {
        doc.setFont(undefined, "bold");
        doc.setFontSize(11);
        if (isCOD) {
          doc.setTextColor(220, 38, 38); // Red for COD pending total
        } else {
          doc.setTextColor(34, 139, 34); // Green for paid total
        }
      } else {
        doc.setTextColor(0, 0, 0);
      }

      doc.text(row[1], pageWidth - margin - 5, yPosition, { align: "right" });
      yPosition += 6;
    });

    yPosition += 5;

    // Notes
    if (order.notes) {
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("NOTES", margin, yPosition);
      yPosition += 7;
      doc.setFont(undefined, "normal");
      doc.setFontSize(10);
      const notesLines = doc.splitTextToSize(cleanTextForPDF(order.notes), maxWidth - 10);
      doc.text(notesLines, margin + 5, yPosition);
      yPosition += notesLines.length * 5 + 5;
    }

    // Order Timeline
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("ORDER TIMELINE", margin, yPosition);
    yPosition += 7;
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    doc.text(`Placed on ${formatDate(order.created_at)} at ${formatTime(order.created_at)}`, margin + 5, yPosition);

    // Save PDF
    const sanitizedName = order.customer_name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    doc.save(`${sanitizedName}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Order Details - {order.order_number}</DialogTitle>
          <Button
            onClick={downloadPDF}
            size="sm"
            variant="outline"
            className="ml-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
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
              {(order.coupon_code || order.discount_amount) && (
                <>
                  {order.coupon_code && (
                    <div className="flex justify-between">
                      <span>Coupon Code:</span>
                      <span className="font-medium text-primary">{order.coupon_code}</span>
                    </div>
                  )}
                  {order.discount_amount && order.discount_amount > 0 && (
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span className="text-red-600 dark:text-red-400 font-medium">-{formatCurrency(order.discount_amount)}</span>
                    </div>
                  )}
                </>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>{getPaymentStatus().label}</span>
                <span className={`${getPaymentStatus().color}`}>{formatCurrency(order.total)}</span>
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
