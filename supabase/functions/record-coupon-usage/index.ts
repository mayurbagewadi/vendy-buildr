import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RecordCouponUsageRequest {
  couponCode: string
  storeId: string
  orderId: string
  customerPhone: string
  customerEmail?: string
  discountApplied: number
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { couponCode, storeId, orderId, customerPhone, customerEmail, discountApplied } =
      await req.json() as RecordCouponUsageRequest

    // Validate input
    if (!couponCode || !storeId || !orderId || !customerPhone) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Get authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      )
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    )

    // 1. Fetch coupon
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('id')
      .eq('store_id', storeId)
      .eq('code', couponCode.toUpperCase())
      .maybeSingle()

    if (couponError || !coupon) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Coupon not found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Record coupon usage
    const { error: insertError } = await supabase
      .from('coupon_usage')
      .insert({
        coupon_id: coupon.id,
        order_id: orderId,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        discount_applied: discountApplied,
        used_at: new Date().toISOString()
      })

    if (insertError) {
      throw insertError
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Coupon usage recorded'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
