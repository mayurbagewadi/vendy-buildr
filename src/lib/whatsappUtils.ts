import { CartItem } from "./cartUtils";
import { supabase } from "@/integrations/supabase/client";

// Validate if WhatsApp number is properly configured
export const isWhatsAppConfigured = async (storeId?: string): Promise<boolean> => {
  const number = await getWhatsAppNumber(storeId);
  const formattedNumber = formatWhatsAppNumber(number);

  // Check if number is empty, default, or invalid
  if (!number || number.trim() === "") return false;
  if (formattedNumber === "919876543210" || formattedNumber === "9876543210") return false;
  if (formattedNumber.length < 10) return false;

  return true;
};

// Get WhatsApp business number from database
// Note: This function now requires async/await in the calling context
export const getWhatsAppNumber = async (storeId?: string): Promise<string> => {
  try {
    // If storeId is provided, use it directly (for customer-facing pages)
    if (storeId) {
      const { data: store } = await supabase
        .from('stores')
        .select('whatsapp_number')
        .eq('id', storeId)
        .single();
      
      return store?.whatsapp_number || "919876543210";
    }

    // Otherwise, try to get from authenticated user (for admin pages)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "919876543210";

    const { data: store } = await supabase
      .from('stores')
      .select('whatsapp_number')
      .eq('user_id', user.id)
      .single();

    return store?.whatsapp_number || "919876543210";
  } catch (error) {
    console.error("Error fetching WhatsApp number:", error);
    return "919876543210";
  }
};

// Format phone number for WhatsApp (remove spaces, dashes, etc.)
export const formatWhatsAppNumber = (number: string): string => {
  return number.replace(/[^0-9+]/g, "");
};

// Generate order message for WhatsApp
export interface OrderDetails {
  customerName: string;
  phone: string;
  email?: string;
  address: string;
  landmark?: string;
  pincode: string;
  deliveryTime: string;
  latitude?: number;
  longitude?: number;
  cart: CartItem[];
  subtotal: number;
  deliveryCharge: number;
  total: number;
  gstEnabled?: boolean;
  gstShowOnSummary?: boolean;
  gstRate?: number;
  taxableAmount?: number;
  gstAmount?: number;
  paymentMethod?: 'cod' | 'online';
  paymentGateway?: string;
  transactionId?: string;
  orderNumber?: string;
}

export const generateOrderMessage = (order: OrderDetails): string => {
  const date = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  let message = `🛍 *NEW ORDER REQUEST*\n`;
  message += `📅 ${date}\n\n`;

  message += `👤 *CUSTOMER DETAILS*\n`;
  message += `Name: ${order.customerName}\n`;
  message += `Phone: ${order.phone}\n`;
  if (order.email) {
    message += `Email: ${order.email}\n`;
  }
  message += `\n📍 *DELIVERY ADDRESS*\n`;
  message += `${order.address}\n`;
  if (order.landmark) {
    message += `Landmark: ${order.landmark}\n`;
  }
  message += `PIN Code: ${order.pincode}\n`;
  message += `Preferred Time: ${order.deliveryTime}\n`;
  
  // Add location link if coordinates are provided
  if (order.latitude && order.longitude) {
    const mapsUrl = `https://www.google.com/maps?q=${order.latitude},${order.longitude}`;
    message += `📍 Location: ${mapsUrl}\n`;
  }
  message += `\n`;

  message += `📦 *ORDER ITEMS*\n`;
  message += `━━━━━━━━━━━━━━━━\n`;

  order.cart.forEach((item, index) => {
    message += `${index + 1}. ${item.productName}\n`;
    if (item.variant) {
      message += `   Variant: ${item.variant}\n`;
    }
    if (item.sku) {
      message += `   SKU: ${item.sku}\n`;
    }
    message += `   Qty: ${item.quantity} × ₹${item.price.toFixed(2)}\n`;
    message += `   Subtotal: ₹${(item.quantity * item.price).toFixed(2)}\n\n`;
  });

  message += `━━━━━━━━━━━━━━━━\n`;
  message += `💰 *PAYMENT SUMMARY*\n`;
  message += `Subtotal: ₹${order.subtotal.toFixed(2)}\n`;
  if (order.gstEnabled && order.gstShowOnSummary && order.gstAmount && order.gstAmount > 0) {
    message += `Taxable Value: ₹${(order.taxableAmount || 0).toFixed(2)}\n`;
    message += `GST (${order.gstRate || 0}%): ₹${order.gstAmount.toFixed(2)}\n`;
  }
  message += `Delivery: ₹${order.deliveryCharge.toFixed(2)}\n`;
  message += `*Total Amount: ₹${order.total.toFixed(2)}*\n\n`;

  if (order.paymentMethod === 'online') {
    message += `✅ *PAYMENT COMPLETED*\n`;
    message += `💳 Payment Method: Online Payment (${order.paymentGateway || 'Gateway'})\n`;
    if (order.orderNumber) {
      message += `📋 Order Number: ${order.orderNumber}\n`;
    }
    if (order.transactionId) {
      message += `🔐 Transaction ID: ${order.transactionId}\n`;
    }
    message += `💚 Payment Status: PAID\n\n`;
    message += `Order is confirmed and payment received. Please process this order. Thank you! 🙏`;
  } else {
    message += `💳 Payment Method: Cash on Delivery (COD)\n\n`;
    message += `Please confirm this order. Thank you! 🙏`;
  }

  return message;
};

// Generate product inquiry message
export interface ProductInquiry {
  productName: string;
  productId: string;
  variant?: string;
  customerName?: string;
}

export const generateProductInquiryMessage = (inquiry: ProductInquiry): string => {
  let message = `👋 Hi! I'm interested in:\n\n`;
  message += `🛍️ *${inquiry.productName}*\n`;
  if (inquiry.variant) {
    message += `Variant: ${inquiry.variant}\n`;
  }
  message += `Product ID: ${inquiry.productId}\n\n`;
  message += `Could you please provide more details about this product?\n\n`;
  message += `Thank you! 😊`;

  return message;
};

// Generate general inquiry message
export const generateGeneralInquiryMessage = (): string => {
  return `👋 Hi! I have a question about your products/services.\n\nCould you please help me?\n\nThank you! 😊`;
};

// Generate support message
export const generateSupportMessage = (): string => {
  return `👋 Hi! I need help with:\n\n[Please describe your issue here]\n\nThank you! 🙏`;
};

// Open WhatsApp with pre-filled message
export const openWhatsApp = async (
  message: string,
  phoneNumber?: string,
  storeId?: string,
  redirect: boolean = false  // ✅ New parameter: true = redirect page, false = new tab
): Promise<{ success: boolean; error?: string }> => {
  // If phoneNumber is not provided, check if WhatsApp is configured
  if (!phoneNumber && !(await isWhatsAppConfigured(storeId))) {
    return {
      success: false,
      error:
        "WhatsApp number is not configured. Please contact the store owner to set up a valid WhatsApp number in admin settings.",
    };
  }

  const number = phoneNumber || (await getWhatsAppNumber(storeId));
  const formattedNumber = formatWhatsAppNumber(number);

  // Additional validation for the specific number being used
  if (formattedNumber === "919876543210" || formattedNumber === "9876543210") {
    return {
      success: false,
      error:
        "Invalid WhatsApp number. The default number 9876543210 is not allowed. Please contact the store owner to set up a valid WhatsApp number.",
    };
  }

  const encodedMessage = encodeURIComponent(message);
  const waUrl = `https://wa.me/${formattedNumber}?text=${encodedMessage}`;

  if (redirect) {
    // ✅ REDIRECT MODE: Change current page to WhatsApp (for automatic redirect after payment)
    // Detect mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      // ✅ MOBILE: Use whatsapp:// scheme for direct app opening (like COD)
      const whatsappSchemeUrl = `whatsapp://send?phone=${formattedNumber}&text=${encodedMessage}`;
      window.location.href = whatsappSchemeUrl;
    } else {
      // ✅ DESKTOP: Use wa.me web URL
      window.location.href = waUrl;
    }
  } else {
    // ✅ NEW TAB MODE: Open WhatsApp in new tab (for manual button click)
    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return { success: true };
};

// Prepare order data for export
export const prepareOrderDataForSheets = (order: OrderDetails) => {
  const orderId = `ORD${Date.now()}`;
  const itemsList = order.cart
    .map((item) => `${item.productName}${item.variant ? ` (${item.variant})` : ""} x${item.quantity}`)
    .join(", ");

  return {
    orderId,
    customerName: order.customerName,
    phone: order.phone,
    email: order.email || "",
    address: order.address,
    landmark: order.landmark || "",
    pincode: order.pincode,
    deliveryTime: order.deliveryTime,
    items: itemsList,
    subtotal: order.subtotal,
    deliveryCharge: order.deliveryCharge,
    total: order.total,
    orderDate: new Date().toISOString(),
    status: "Pending",
  };
};
