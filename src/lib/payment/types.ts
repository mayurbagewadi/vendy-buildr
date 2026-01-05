// Payment gateway types and interfaces

export interface PaymentGatewayCredentials {
  razorpay?: {
    enabled: boolean;
    key_id: string | null;
    key_secret: string | null;
  };
  phonepe?: {
    enabled: boolean;
    merchant_id: string | null;
    salt_key: string | null;
    salt_index: string | null;
  };
  cashfree?: {
    enabled: boolean;
    app_id: string | null;
    secret_key: string | null;
  };
  payu?: {
    enabled: boolean;
    merchant_key: string | null;
    merchant_salt: string | null;
  };
  paytm?: {
    enabled: boolean;
    merchant_id: string | null;
    merchant_key: string | null;
  };
  stripe?: {
    enabled: boolean;
    publishable_key: string | null;
    secret_key: string | null;
  };
}

export interface OrderDetails {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  amount: number;
  currency: string;
}

export interface PaymentCallbacks {
  onSuccess: (response: any) => void;
  onFailure: (error: any) => void;
  onDismiss?: () => void;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  gatewayOrderId?: string;
  signature?: string;
  error?: string;
  response?: any;
}
