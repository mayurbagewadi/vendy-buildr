import { CartItem } from './cartUtils';

// Validate if WhatsApp number is properly configured
export const isWhatsAppConfigured = (): boolean => {
  const number = getWhatsAppNumber();
  const formattedNumber = formatWhatsAppNumber(number);
  
  // Check if number is empty, default, or invalid
  if (!number || number.trim() === '') return false;
  if (formattedNumber === '919876543210' || formattedNumber === '9876543210') return false;
  if (formattedNumber.length < 10) return false;
  
  return true;
};

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
export const openWhatsApp = (message: string, phoneNumber?: string): { success: boolean; error?: string } => {
  // If phoneNumber is not provided, check if WhatsApp is configured
  if (!phoneNumber && !isWhatsAppConfigured()) {
    return {
      success: false,
      error: 'WhatsApp number is not configured. Please contact the store owner to set up a valid WhatsApp number in admin settings.'
    };
  }
  
  const number = phoneNumber || getWhatsAppNumber();
  const formattedNumber = formatWhatsAppNumber(number);
  
  // Additional validation for the specific number being used
  if (formattedNumber === '919876543210' || formattedNumber === '9876543210') {
    return {
      success: false,
      error: 'Invalid WhatsApp number. The default number 9876543210 is not allowed. Please contact the store owner to set up a valid WhatsApp number.'
    };
  }
  
  const encodedMessage = encodeURIComponent(message);
  
  // Detect device type
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Desktop: Use api.whatsapp.com which triggers native protocol handler dialog
  // Mobile: Use wa.me for better app deep linking
  const whatsappUrl = isMobile
    ? `https://wa.me/${formattedNumber}?text=${encodedMessage}`
    : `https://api.whatsapp.com/send?phone=${formattedNumber}&text=${encodedMessage}`;
  
  window.open(whatsappUrl, '_blank');
  return { success: true };
};

// Export order data for Google Sheets tracking
export const prepareOrderDataForSheets = (order: OrderDetails) => {
  const orderId = `ORD${Date.now()}`;
  const itemsList = order.cart.map(item => 
    `${item.productName}${item.variant ? ` (${item.variant})` : ''} x${item.quantity}`
  ).join(', ');

  return {
    orderId,
    customerName: order.customerName,
    phone: order.phone,
    email: order.email || '',
    address: order.address,
    landmark: order.landmark || '',
    pincode: order.pincode,
    deliveryTime: order.deliveryTime,
    items: itemsList,
    subtotal: order.subtotal,
    deliveryCharge: order.deliveryCharge,
    total: order.total,
    orderDate: new Date().toISOString(),
    status: 'Pending'
  };
};
