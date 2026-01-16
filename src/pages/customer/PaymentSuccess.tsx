import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { verifyRazorpayPayment } from "@/lib/payment/razorpay";
import { generateOrderMessage, openWhatsApp } from "@/lib/whatsappUtils";
import { CheckCircle2, XCircle, Loader2, MessageCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Enterprise Payment Success Page
 *
 * Professional UX Flow:
 * 1. Verify payment in background
 * 2. Show success UI with order details
 * 3. User manually clicks "Open WhatsApp" button (user gesture)
 * 4. WhatsApp opens reliably (browser allows user-initiated action)
 * 5. No automatic redirects, no toast notifications
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

        // ✅ Auto-redirect to WhatsApp after 2 seconds (REDIRECT MODE - changes current page)
        setTimeout(() => {
          openWhatsApp(message, undefined, storeIdParam, true);  // true = redirect current page
        }, 2000);

      } catch (error: any) {
        console.error('Payment processing error:', error);
        setStatus('failed');
      }
    };

    processPayment();
  }, [searchParams]);

  // Handler for WhatsApp button click (user gesture - opens in new tab as backup)
  const handleOpenWhatsApp = () => {
    openWhatsApp(whatsappMessage, undefined, storeId, false);  // false = open in new tab
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

              {/* Important Notice */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5">
                <p className="text-blue-900 text-center font-medium leading-relaxed">
                  Complete your order by sending the details to our WhatsApp
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                {/* Primary CTA - WhatsApp */}
                <Button
                  onClick={handleOpenWhatsApp}
                  size="lg"
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <MessageCircle className="w-6 h-6 mr-3" />
                  Complete Order on WhatsApp
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
