import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { verifyRazorpayPayment } from "@/lib/payment/razorpay";
import { generateOrderMessage, getWhatsAppNumber, formatWhatsAppNumber, isWhatsAppConfigured } from "@/lib/whatsappUtils";
import { CheckCircle2, XCircle, Loader2, MessageCircle, Home, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Enterprise Payment Success Page
 *
 * Professional UX Flow:
 * 1. Verify payment in background
 * 2. Show success UI with order details
 * 3. Auto-redirect to WhatsApp on mobile (deep linking)
 * 4. Fallback button if auto-redirect fails
 */
export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [orderNumber, setOrderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [storeId, setStoreId] = useState('');
  const [storeSlug, setStoreSlug] = useState('');
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const autoRedirectAttempted = useRef(false);

  // Detect if mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Auto-open WhatsApp function with deep linking
  const autoOpenWhatsApp = async (message: string, storeIdParam: string) => {
    if (autoRedirectAttempted.current) return;
    autoRedirectAttempted.current = true;

    try {
      // Check if WhatsApp is configured
      const isConfigured = await isWhatsAppConfigured(storeIdParam);
      if (!isConfigured) {
        setShowFallback(true);
        return;
      }

      const number = await getWhatsAppNumber(storeIdParam);
      const formattedNumber = formatWhatsAppNumber(number);
      const encodedMessage = encodeURIComponent(message);

      if (isMobile) {
        // ✅ MOBILE: Use intent:// for Android and whatsapp:// for iOS
        const isAndroid = /Android/i.test(navigator.userAgent);
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (isAndroid) {
          // Android Intent URL - most reliable for auto-open
          const intentUrl = `intent://send/${formattedNumber}#Intent;scheme=whatsapp;package=com.whatsapp;action=android.intent.action.SENDTO;S.android.intent.extra.TEXT=${encodedMessage};end`;
          
          // Try intent first, fallback to whatsapp:// scheme
          try {
            window.location.href = intentUrl;
          } catch {
            window.location.href = `whatsapp://send?phone=${formattedNumber}&text=${encodedMessage}`;
          }
        } else if (isIOS) {
          // iOS: Use whatsapp:// scheme directly
          window.location.href = `whatsapp://send?phone=${formattedNumber}&text=${encodedMessage}`;
        } else {
          // Other mobile: Use whatsapp:// scheme
          window.location.href = `whatsapp://send?phone=${formattedNumber}&text=${encodedMessage}`;
        }

        setWhatsappOpened(true);
        
        // Show fallback after 3 seconds if user is still on page
        setTimeout(() => {
          setShowFallback(true);
        }, 3000);

      } else {
        // ✅ DESKTOP: Open wa.me in new tab (don't redirect page)
        const waUrl = `https://wa.me/${formattedNumber}?text=${encodedMessage}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
        setWhatsappOpened(true);
        setShowFallback(true);
      }
    } catch (error) {
      console.error('WhatsApp auto-open error:', error);
      setShowFallback(true);
    }
  };

  useEffect(() => {
    const processPayment = async () => {
      // Get gateway type from URL
      const gateway = searchParams.get('gateway');
      const orderId = searchParams.get('orderId');
      const storeIdParam = searchParams.get('storeId');
      const storeSlugParam = searchParams.get('storeSlug');

      setStoreId(storeIdParam || '');
      setStoreSlug(storeSlugParam || '');

      // Validate required parameters
      if (!gateway || !orderId || !storeIdParam) {
        setStatus('failed');
        return;
      }

      try {
        let verified = false;
        let paymentId = '';

        // Handle Razorpay payment verification
        if (gateway === 'razorpay') {
          const razorpayOrderId = searchParams.get('razorpayOrderId');
          const razorpayPaymentId = searchParams.get('paymentId');
          const signature = searchParams.get('signature');

          if (!razorpayOrderId || !razorpayPaymentId || !signature) {
            throw new Error('Missing Razorpay payment details');
          }

          // Verify payment signature
          const verifyResult = await verifyRazorpayPayment(
            razorpayOrderId,
            razorpayPaymentId,
            signature,
            storeIdParam
          );

          verified = verifyResult.verified;
          paymentId = razorpayPaymentId;

          // Update order with payment details
          if (verified) {
            await supabase
              .from('orders')
              .update({
                payment_status: 'completed',
                payment_id: razorpayPaymentId,
                payment_gateway: 'razorpay',
                gateway_order_id: razorpayOrderId,
                payment_response: {
                  razorpay_payment_id: razorpayPaymentId,
                  razorpay_order_id: razorpayOrderId,
                  razorpay_signature: signature,
                },
              })
              .eq('id', orderId);
          }
        }

        // Check if payment was verified
        if (!verified) {
          setStatus('failed');
          return;
        }

        // Fetch complete order details
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (orderError || !orderData) {
          throw new Error('Failed to fetch order details');
        }

        // Prepare WhatsApp message
        const message = generateOrderMessage({
          customerName: orderData.customer_name,
          phone: orderData.customer_phone,
          email: orderData.customer_email,
          address: orderData.delivery_address,
          landmark: orderData.delivery_landmark,
          pincode: orderData.delivery_pincode,
          deliveryTime: orderData.delivery_time,
          latitude: orderData.delivery_latitude,
          longitude: orderData.delivery_longitude,
          cart: orderData.items as any[],
          subtotal: orderData.subtotal,
          deliveryCharge: orderData.delivery_charge || 0,
          total: orderData.total,
          paymentMethod: 'online' as const,
          paymentGateway: 'Razorpay',
          transactionId: paymentId,
          orderNumber: orderData.order_number,
        });

        setWhatsappMessage(message);
        setOrderNumber(orderData.order_number);
        setTransactionId(paymentId);
        setStatus('success');

        // ✅ IMMEDIATE AUTO-REDIRECT to WhatsApp (deep linking)
        // Small delay to ensure UI renders first
        setTimeout(() => {
          autoOpenWhatsApp(message, storeIdParam);
        }, 500);

      } catch (error: any) {
        console.error('Payment processing error:', error);
        setStatus('failed');
      }
    };

    processPayment();
  }, [searchParams]);

  // Handler for WhatsApp button click (manual fallback)
  const handleOpenWhatsApp = async () => {
    if (!whatsappMessage || !storeId) return;
    
    const number = await getWhatsAppNumber(storeId);
    const formattedNumber = formatWhatsAppNumber(number);
    const encodedMessage = encodeURIComponent(whatsappMessage);

    if (isMobile) {
      // Mobile: Use deep link
      window.location.href = `whatsapp://send?phone=${formattedNumber}&text=${encodedMessage}`;
    } else {
      // Desktop: Open in new tab
      window.open(`https://wa.me/${formattedNumber}?text=${encodedMessage}`, '_blank');
    }
  };

  // Handler for home navigation
  const handleGoHome = () => {
    navigate(storeSlug ? `/${storeSlug}` : "/home");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 px-4 py-8">
      <div className="max-w-md w-full">

        {/* Verifying State */}
        {status === 'verifying' && (
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <Loader2 className="h-20 w-20 text-blue-600 mx-auto animate-spin mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Payment</h2>
            <p className="text-gray-600">Please wait while we confirm your payment...</p>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-white mb-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Payment Successful!</h2>
              <p className="text-green-100">Your order has been confirmed</p>
            </div>

            {/* Order Details */}
            <div className="p-8 space-y-6">
              <div className="bg-gray-50 rounded-2xl p-6 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Order Number</span>
                  <span className="text-gray-900 font-bold">{orderNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Transaction ID</span>
                  <span className="text-gray-900 font-mono text-sm">{transactionId.slice(0, 20)}...</span>
                </div>
              </div>

              {/* Auto-redirect notice */}
              {!showFallback && whatsappOpened && (
                <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 animate-pulse">
                  <div className="flex items-center justify-center gap-2 text-green-800 font-medium">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Opening WhatsApp...</span>
                  </div>
                </div>
              )}

              {/* Fallback notice - shown after auto-redirect attempt */}
              {showFallback && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5">
                  <p className="text-amber-900 text-center font-medium leading-relaxed flex items-center justify-center gap-2">
                    <ExternalLink className="w-5 h-5" />
                    {isMobile ? "Tap below if WhatsApp didn't open" : "Click below to complete your order on WhatsApp"}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                {/* Primary CTA - WhatsApp */}
                <Button
                  onClick={handleOpenWhatsApp}
                  size="lg"
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <MessageCircle className="w-6 h-6 mr-3" />
                  {showFallback ? "Open WhatsApp Now" : "Complete Order on WhatsApp"}
                </Button>

                {/* Secondary CTA - Home */}
                <Button
                  onClick={handleGoHome}
                  variant="outline"
                  size="lg"
                  className="w-full h-12 text-gray-700 border-2 hover:bg-gray-50"
                >
                  <Home className="w-5 h-5 mr-2" />
                  Back to Home
                </Button>
              </div>

              {/* Footer Note */}
              <p className="text-center text-sm text-gray-500 mt-6">
                Your payment has been received. We'll process your order shortly.
              </p>
            </div>
          </div>
        )}

        {/* Failed State */}
        {status === 'failed' && (
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-6">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Payment Verification Failed</h2>
            <p className="text-gray-600 mb-6">There was an issue verifying your payment.</p>
            <p className="text-sm text-gray-500 mb-8">
              If the amount was deducted from your account, please contact our support with your transaction details.
            </p>
            <Button
              onClick={handleGoHome}
              size="lg"
              variant="outline"
              className="w-full"
            >
              <Home className="w-5 h-5 mr-2" />
              Back to Home
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
