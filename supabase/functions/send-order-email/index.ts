import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { orderId, storeId } = await req.json();

    if (!orderId || !storeId) {
      throw new Error('orderId and storeId are required');
    }

    // Get store and user details
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('name, user_id')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      throw new Error('Store not found');
    }

    // Get user profile with email
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', store.user_id)
      .single();

    if (profileError || !profile?.email) {
      throw new Error('Store owner email not found');
    }

    // Check if user's subscription plan has email notifications enabled
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('plan_id, subscription_plans(enable_order_emails)')
      .eq('user_id', store.user_id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      console.log('No active subscription found for user');
      return new Response(
        JSON.stringify({ success: false, message: 'No active subscription' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const plan = subscription.subscription_plans as any;
    if (!plan?.enable_order_emails) {
      console.log('Order emails not enabled for this plan');
      return new Response(
        JSON.stringify({ success: false, message: 'Feature not enabled in plan' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // Format order items for email
    const itemsHtml = (order.items as any[]).map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price * item.quantity}</td>
      </tr>
    `).join('');

    // Send email using Resend API
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Store Orders <onboarding@resend.dev>',
        to: [profile.email],
        subject: `New Order #${order.order_number} - ${store.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; margin-bottom: 20px;">New Order Received! 🎉</h2>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #666; margin: 0 0 10px 0;">Order Details</h3>
              <p style="margin: 5px 0;"><strong>Order Number:</strong> ${order.order_number}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> ${order.status}</p>
              <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${order.payment_method}</p>
            </div>

            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #666; margin: 0 0 10px 0;">Customer Information</h3>
              <p style="margin: 5px 0;"><strong>Name:</strong> ${order.customer_name}</p>
              <p style="margin: 5px 0;"><strong>Phone:</strong> ${order.customer_phone}</p>
              ${order.customer_email ? `<p style="margin: 5px 0;"><strong>Email:</strong> ${order.customer_email}</p>` : ''}
              <p style="margin: 5px 0;"><strong>Address:</strong> ${order.delivery_address}</p>
              ${order.delivery_landmark ? `<p style="margin: 5px 0;"><strong>Landmark:</strong> ${order.delivery_landmark}</p>` : ''}
              ${order.delivery_pincode ? `<p style="margin: 5px 0;"><strong>Pincode:</strong> ${order.delivery_pincode}</p>` : ''}
            </div>

            <div style="margin-bottom: 20px;">
              <h3 style="color: #666;">Order Items</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f0f0f0;">
                    <th style="padding: 8px; text-align: left;">Item</th>
                    <th style="padding: 8px; text-align: center;">Qty</th>
                    <th style="padding: 8px; text-align: right;">Price</th>
                    <th style="padding: 8px; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </div>

            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                <span>Subtotal:</span>
                <strong>₹${order.subtotal}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                <span>Delivery Charge:</span>
                <strong>₹${order.delivery_charge}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 10px 0; padding-top: 10px; border-top: 2px solid #333; font-size: 18px;">
                <span>Total:</span>
                <strong>₹${order.total}</strong>
              </div>
            </div>

            ${order.notes ? `
              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #856404; margin: 0 0 10px 0;">Special Instructions</h3>
                <p style="margin: 0; color: #856404;">${order.notes}</p>
              </div>
            ` : ''}

            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              This is an automated notification from your store management system.
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      throw new Error(errorData.message || 'Failed to send email');
    }

    const emailData = await emailResponse.json();
    console.log('Order email sent successfully:', emailData);

    return new Response(
      JSON.stringify({ success: true, data: emailData }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error sending order email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
