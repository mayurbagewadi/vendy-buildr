import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { verifyPhonePePayment } from "@/lib/payment/phonepe";
import { verifyRazorpayPayment } from "@/lib/payment/razorpay";
import { generateOrderMessage } from "@/lib/whatsappUtils";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/components/ui/use-toast";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

/**
 * Payment Success Page
 *
 * Handles payment verification and WhatsApp redirect for all payment gateways
 * Flow: Verify Payment → Show Success Toast (1 sec) → Auto-redirect to WhatsApp
 *
 * Supported Gateways:
 * - Razorpay
 * - PhonePe
 */
export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');

  useEffect(() => {
    const processPayment = async () => {
      // Get gateway type from URL
      const gateway = searchParams.get('gateway');
      const orderId = searchParams.get('orderId');
      const storeId = searchParams.get('storeId');
      const storeSlug = searchParams.get('storeSlug');

      // Validate required parameters
      if (!gateway || !orderId || !storeId) {
        setStatus('failed');
        toast({
          title: "Invalid Payment Link",
          description: "Missing required payment information.",
          variant: "destructive",
        });
        return;
      }

      try {
        let verified = false;
        let verifyError = '';
        let paymentId = '';
        let gatewayName = '';

        // Handle different payment gateways
        if (gateway === 'razorpay') {
          // Razorpay payment verification
          const razorpayOrderId = searchParams.get('razorpayOrderId');
          const razorpayPaymentId = searchParams.get('paymentId');
          const signature = searchParams.get('signature');

          if (!razorpayOrderId || !razorpayPaymentId || !signature) {
            throw new Error('Missing Razorpay payment details');
          }

          // Verify Razorpay payment signature
          const verifyResult = await verifyRazorpayPayment(
            razorpayOrderId,
            razorpayPaymentId,
            signature,
            storeId
          );

          verified = verifyResult.verified;
          verifyError = verifyResult.error || '';
          paymentId = razorpayPaymentId;
          gatewayName = 'Razorpay';

          // Update order with Razorpay payment details
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

        } else if (gateway === 'phonepe') {
          // PhonePe payment verification
          const merchantTransactionId = searchParams.get('merchantTransactionId') || searchParams.get('paymentId');

          if (!merchantTransactionId) {
            throw new Error('Missing PhonePe transaction ID');
          }

          // Verify PhonePe payment
          const verifyResult = await verifyPhonePePayment(
            merchantTransactionId,
            storeId
          );

          verified = verifyResult.verified;
          verifyError = verifyResult.error || '';
          paymentId = merchantTransactionId;
          gatewayName = 'PhonePe';

          // Update order with PhonePe payment details
          if (verified) {
            await supabase
              .from('orders')
              .update({
                payment_status: 'completed',
                payment_id: merchantTransactionId,
                payment_gateway: 'phonepe',
                gateway_order_id: merchantTransactionId,
              })
              .eq('id', orderId);
          }

        } else {
          throw new Error(`Unsupported payment gateway: ${gateway}`);
        }

        // Check if payment was verified
        if (!verified) {
          setStatus('failed');
          toast({
            title: "Payment Verification Failed",
            description: verifyError || "Unable to verify your payment. Please contact support.",
            variant: "destructive",
          });
          return;
        }

        // Fetch complete order details from database
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (orderError || !orderData) {
          throw new Error('Failed to fetch order details');
        }

        // Fetch order items from order_items table
        const { data: orderItems } = await supabase
          .from('order_items')
          .select(`
            id,
            product_id,
            quantity,
            price,
            variant,
            sku,
            products (
              name,
              slug
            )
          `)
          .eq('order_id', orderId);

        // Convert order items to cart format for WhatsApp message
        const cartItems = orderItems?.map(item => ({
          id: item.product_id,
          productId: item.product_id,
          productName: item.products?.name || 'Product',
          productSlug: item.products?.slug || '',
          quantity: item.quantity,
          price: item.price,
          variant: item.variant,
          sku: item.sku,
          storeId: storeId,
        })) || [];

        // Prepare WhatsApp order details with payment confirmation
        const whatsappOrderDetails = {
          customerName: orderData.customer_name,
          phone: orderData.customer_phone,
          email: orderData.customer_email,
          address: orderData.delivery_address,
          landmark: orderData.delivery_landmark,
          pincode: orderData.delivery_pincode,
          deliveryTime: orderData.delivery_time,
          latitude: orderData.delivery_latitude,
          longitude: orderData.delivery_longitude,
          cart: cartItems,
          subtotal: orderData.subtotal,
          deliveryCharge: orderData.delivery_charge || 0,
          total: orderData.total,
          paymentMethod: 'online' as const,
          paymentGateway: gatewayName,
          transactionId: paymentId,
          orderNumber: orderData.order_number,
        };

        // Generate WhatsApp message
        const whatsappMessage = generateOrderMessage(whatsappOrderDetails);

        // Get store WhatsApp number
        const { data: store } = await supabase
          .from('stores')
          .select('whatsapp_number')
          .eq('id', storeId)
          .single();

        const whatsappNumber = store?.whatsapp_number || '';

        // Format WhatsApp number (remove non-digits)
        const formattedNumber = whatsappNumber.replace(/[^0-9]/g, '');

        // Build WhatsApp URL with pre-filled message
        const encodedMessage = encodeURIComponent(whatsappMessage);
        const whatsappUrl = `https://wa.me/${formattedNumber}?text=${encodedMessage}`;

        // Show success status
        setStatus('success');

        // Show success toast notification
        toast({
          title: "Payment Successful!",
          description: "Redirecting to WhatsApp...",
        });

        // Clear cart
        clearCart();

        // Wait 1 second, then redirect to WhatsApp using window.location.href
        setTimeout(() => {
          window.location.href = whatsappUrl;
        }, 1000);

      } catch (error: any) {
        console.error('Payment processing error:', error);
        setStatus('failed');
        toast({
          title: "Error Processing Payment",
          description: error.message || "Something went wrong. Please contact support.",
          variant: "destructive",
        });
      }
    };

    processPayment();
  }, [searchParams, clearCart]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">

        {/* Verifying State */}
        {status === 'verifying' && (
          <div className="space-y-4">
            <Loader2 className="h-16 w-16 text-blue-600 mx-auto animate-spin" />
            <h2 className="text-2xl font-bold text-gray-900">Verifying Payment</h2>
            <p className="text-gray-600">Please wait while we confirm your payment...</p>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="space-y-4">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Payment Successful!</h2>
            <p className="text-gray-600">Your order has been confirmed.</p>
            <p className="text-sm text-gray-500">Redirecting to WhatsApp in 1 second...</p>
          </div>
        )}

        {/* Failed State */}
        {status === 'failed' && (
          <div className="space-y-4">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Payment Failed</h2>
            <p className="text-gray-600">There was an issue verifying your payment.</p>
            <p className="text-sm text-gray-500">Please contact support if the amount was deducted.</p>
          </div>
        )}
      </div>
    </div>
  );
}
