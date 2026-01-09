import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { verifyPhonePePayment } from "@/lib/payment/phonepe";
import { generateOrderMessage, openWhatsApp } from "@/lib/whatsappUtils";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/components/ui/use-toast";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');

  useEffect(() => {
    const verifyPaymentAndNotify = async () => {
      const merchantTransactionId = searchParams.get('merchantTransactionId');
      const storeId = searchParams.get('storeId');
      const orderId = searchParams.get('orderId');
      const storeSlug = searchParams.get('storeSlug');

      if (!merchantTransactionId || !storeId || !orderId) {
        setStatus('failed');
        toast({
          title: "Invalid payment link",
          description: "Missing payment information.",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate(storeSlug ? `/${storeSlug}` : "/home");
        }, 3000);
        return;
      }

      try {
        // Verify payment with PhonePe
        const { verified, error: verifyError } = await verifyPhonePePayment(
          merchantTransactionId,
          storeId
        );

        if (!verified) {
          setStatus('failed');
          toast({
            title: "Payment verification failed",
            description: verifyError || "Please contact support.",
            variant: "destructive",
          });
          setTimeout(() => {
            navigate(storeSlug ? `/${storeSlug}` : "/home");
          }, 3000);
          return;
        }

        // Update order with payment details
        await supabase
          .from('orders')
          .update({
            payment_status: 'completed',
            payment_id: merchantTransactionId,
            payment_gateway: 'phonepe',
            gateway_order_id: merchantTransactionId,
          })
          .eq('id', orderId);

        // Fetch complete order details for WhatsApp
        const { data: orderData } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (!orderData) {
          throw new Error('Order not found');
        }

        // Fetch order items from database
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

        // Convert order items to cart format
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

        // Generate WhatsApp message with payment confirmation
        const whatsappOrderDetails = {
          customerName: orderData.customer_name,
          phone: orderData.phone,
          email: orderData.email,
          address: orderData.address,
          landmark: orderData.landmark,
          pincode: orderData.pincode,
          deliveryTime: orderData.delivery_time,
          latitude: orderData.latitude,
          longitude: orderData.longitude,
          cart: cartItems,
          subtotal: orderData.subtotal,
          deliveryCharge: orderData.delivery_charge || 0,
          total: orderData.total,
          paymentMethod: 'online' as const,
          paymentGateway: 'PhonePe',
          transactionId: merchantTransactionId,
          orderNumber: orderData.order_number,
        };

        const message = generateOrderMessage(whatsappOrderDetails);
        await openWhatsApp(message, undefined, storeId);

        setStatus('success');
        toast({
          title: "Payment successful!",
          description: "Your order has been confirmed.",
        });

        // Clear cart
        clearCart();

        // Navigate to home
        setTimeout(() => {
          navigate(storeSlug ? `/${storeSlug}` : "/home");
        }, 2000);

      } catch (error: any) {
        console.error('Payment verification error:', error);
        setStatus('failed');
        toast({
          title: "Error processing payment",
          description: error.message || "Please contact support.",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate(storeSlug ? `/${storeSlug}` : "/home");
        }, 3000);
      }
    };

    verifyPaymentAndNotify();
  }, [searchParams, navigate, clearCart]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Payment</h2>
            <p className="text-gray-600">Please wait while we verify your payment...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-4">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
            <p className="text-gray-600">Your order has been confirmed. Redirecting to WhatsApp...</p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="mb-4">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h2>
            <p className="text-gray-600">There was an issue with your payment. Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
}
