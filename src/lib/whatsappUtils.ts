import { CartItem } from './cartUtils';

// Get WhatsApp business number from settings
export const getWhatsAppNumber = (): string => {
  // Try multiple storage keys for backward compatibility
  const savedNumber = localStorage.getItem('whatsapp_business_number');
  if (savedNumber) return savedNumber;
  
  // Try store_settings (new format)
  try {
    const settings = localStorage.getItem('store_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.whatsappNumber || '919876543210';
    }
  } catch (error) {
    console.error('Error reading WhatsApp number from settings:', error);
  }
  
  // Try storeSettings (old format)
  try {
    const oldSettings = localStorage.getItem('storeSettings');
    if (oldSettings) {
      const parsed = JSON.parse(oldSettings);
      return parsed.whatsapp || '919876543210';
    }
  } catch (error) {
    console.error('Error reading WhatsApp number from old settings:', error);
  }
  
  return '919876543210'; // Default Indian format
};

// Format phone number for WhatsApp (remove spaces, dashes, etc.)
export const formatWhatsAppNumber = (number: string): string => {
  return number.replace(/[^0-9+]/g, '');
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
  cart: CartItem[];
  subtotal: number;
  deliveryCharge: number;
  total: number;
}

export const generateOrderMessage = (order: OrderDetails): string => {
  const date = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  let message = `🛍️ *NEW ORDER REQUEST*\n`;
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
  message += `Preferred Time: ${order.deliveryTime}\n\n`;
  
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
  message += `Delivery: ₹${order.deliveryCharge.toFixed(2)}\n`;
  message += `*Total Amount: ₹${order.total.toFixed(2)}*\n\n`;
  
  message += `💳 Payment Method: Cash on Delivery (COD)\n\n`;
  message += `Please confirm this order. Thank you! 🙏`;
  
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
export const openWhatsApp = (message: string, phoneNumber?: string): void => {
  const number = phoneNumber || getWhatsAppNumber();
  const formattedNumber = formatWhatsAppNumber(number);
  const encodedMessage = encodeURIComponent(message);
  
  // Use api.whatsapp.com for better mobile/desktop compatibility
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedNumber}&text=${encodedMessage}`;
  
  window.open(whatsappUrl, '_blank');
};
