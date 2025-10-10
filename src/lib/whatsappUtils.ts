import { getSettings } from "./settingsData";

// ✅ Get WhatsApp number from store settings
export const getWhatsAppNumber = (): string => {
  const settings = getSettings();
  return settings.whatsappNumber;
};

// ✅ Open WhatsApp chat with prefilled message
export const openWhatsApp = (message: string): { success: boolean; error?: string } => {
  const phoneNumber = getWhatsAppNumber();

  if (!phoneNumber || phoneNumber === "919876543210") {
    return {
      success: false,
      error: "WhatsApp number not configured. Please contact the store admin.",
    };
  }

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

  // open WhatsApp window
  window.open(whatsappUrl, "_blank");

  return { success: true };
};

// ✅ Generate a general inquiry message
export const generateGeneralInquiryMessage = (): string => {
  const settings = getSettings();
  return `Hello ${settings.storeName}! I have a question about your products.`;
};

// ✅ Generate a product-specific inquiry message
export const generateProductInquiryMessage = (inquiry: {
  productName: string;
  productId: string;
  variant?: string;
}): string => {
  const settings = getSettings();
  const variantInfo = inquiry.variant ? ` (${inquiry.variant})` : "";
  return `Hello ${settings.storeName}! I'm interested in "${inquiry.productName}"${variantInfo} (ID: ${inquiry.productId}). Can you provide more details?`;
};

// ✅ Generate an order message for WhatsApp checkout
export const generateOrderMessage = (orderDetails: {
  customerName: string;
  phone: string;
  email?: string;
  address: string;
  landmark?: string;
  pincode: string;
  deliveryTime: string;
  cart: Array<{
    productId: string;
    productName: string;
    variant?: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  deliveryCharge: number;
  total: number;
}): string => {
  const settings = getSettings();
  const orderId = `#ORD${Date.now()}`;

  const itemsList = orderDetails.cart
    .map((item) => {
      const variantInfo = item.variant ? ` (${item.variant})` : "";
      return `• ${item.productName}${variantInfo} - ${settings.currencySymbol}${item.price.toFixed(
        2,
      )} (Qty: ${item.quantity})`;
    })
    .join("\n");

  return `*New Order Request*

*Order Details:*
${itemsList}

*Subtotal:* ${settings.currencySymbol}${orderDetails.subtotal.toFixed(2)}
*Delivery:* ${settings.currencySymbol}${orderDetails.deliveryCharge.toFixed(2)}
*Total:* ${settings.currencySymbol}${orderDetails.total.toFixed(2)}

*Customer Info:*
Name: ${orderDetails.customerName}
Phone: ${orderDetails.phone}
${orderDetails.email ? `Email: ${orderDetails.email}` : ""}

*Delivery Address:*
${orderDetails.address}
${orderDetails.landmark ? `Landmark: ${orderDetails.landmark}` : ""}
Pincode: ${orderDetails.pincode}
Preferred Time: ${orderDetails.deliveryTime}

Order ID: ${orderId}`;
};

// ✅ Prepare data for Google Sheets integration
export const prepareOrderDataForSheets = (orderDetails: {
  customerName: string;
  phone: string;
  email?: string;
  address: string;
  landmark?: string;
  pincode: string;
  deliveryTime: string;
  cart: Array<{
    productId: string;
    productName: string;
    variant?: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  deliveryCharge: number;
  total: number;
}) => {
  const orderId = `ORD${Date.now()}`;
  const orderDate = new Date().toISOString();

  // Convert cart items into a single string for sheet storage
  const itemsString = orderDetails.cart
    .map((item) => {
      const variantInfo = item.variant ? ` (${item.variant})` : "";
      const totalPrice = item.price * item.quantity;
      return `${item.productName}${variantInfo} x${item.quantity} - ₹${totalPrice}`;
    })
    .join(" | ");

  return {
    orderId,
    orderDate,
    customerName: orderDetails.customerName,
    phone: orderDetails.phone,
    email: orderDetails.email || "",
    address: `${orderDetails.address}${orderDetails.landmark ? `, ${orderDetails.landmark}` : ""}`,
    pincode: orderDetails.pincode,
    deliveryTime: orderDetails.deliveryTime,
    items: itemsString,
    subtotal: orderDetails.subtotal,
    deliveryCharge: orderDetails.deliveryCharge,
    total: orderDetails.total,
    status: "Pending",
  };
};
