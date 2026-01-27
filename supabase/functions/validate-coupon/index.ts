import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidateCouponRequest {
  couponCode: string
  storeId: string
  cartTotal: number
  customerPhone: string
  customerEmail?: string
}

interface ValidateCouponResponse {
  valid: boolean
  discount: number
  finalTotal: number
  coupon?: {
    id: string
    code: string
    discount_type: string
    discount_value: number
  }
  error?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { couponCode, storeId, cartTotal, customerPhone, customerEmail } =
      await req.json() as ValidateCouponRequest

    // Validate input
    if (!couponCode || !storeId || !cartTotal || !customerPhone) {
      return new Response(
        JSON.stringify({
          valid: false,
          discount: 0,
          finalTotal: cartTotal,
          error: 'Missing required fields'
        } as ValidateCouponResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Get authorization from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          valid: false,
          discount: 0,
          finalTotal: cartTotal,
          error: 'Unauthorized'
        } as ValidateCouponResponse),
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
      .select('*')
      .eq('store_id', storeId)
      .eq('code', couponCode.toUpperCase())
      .maybeSingle()

    if (couponError || !coupon) {
      return new Response(
        JSON.stringify({
          valid: false,
          discount: 0,
          finalTotal: cartTotal,
          error: 'Coupon not found'
        } as ValidateCouponResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Check if coupon is active
    if (coupon.status !== 'active') {
      return new Response(
        JSON.stringify({
          valid: false,
          discount: 0,
          finalTotal: cartTotal,
          error: 'Coupon is not active'
        } as ValidateCouponResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Check if coupon has expired
    const now = new Date()
    const expiryDate = new Date(coupon.expiry_date)
    if (expiryDate < now) {
      return new Response(
        JSON.stringify({
          valid: false,
          discount: 0,
          finalTotal: cartTotal,
          error: 'Coupon has expired'
        } as ValidateCouponResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Check if coupon has started
    const startDate = new Date(coupon.start_date)
    if (startDate > now) {
      return new Response(
        JSON.stringify({
          valid: false,
          discount: 0,
          finalTotal: cartTotal,
          error: 'Coupon is not yet active'
        } as ValidateCouponResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Check minimum order value
    if (coupon.min_order_value && cartTotal < coupon.min_order_value) {
      return new Response(
        JSON.stringify({
          valid: false,
          discount: 0,
          finalTotal: cartTotal,
          error: `Minimum order value of ₹${coupon.min_order_value} required`
        } as ValidateCouponResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Check customer type targeting (new vs returning)
    if (coupon.customer_type !== 'all') {
      const { data: orders } = await supabase
        .from('orders')
        .select('id', { count: 'exact' })
        .eq('store_id', storeId)
        .or(`customer_phone.eq.${customerPhone},customer_email.eq.${customerEmail || ''}`)
        .limit(1)

      const isNewCustomer = !orders || orders.length === 0

      if (coupon.customer_type === 'new' && !isNewCustomer) {
        return new Response(
          JSON.stringify({
            valid: false,
            discount: 0,
            finalTotal: cartTotal,
            error: 'This coupon is for new customers only'
          } as ValidateCouponResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (coupon.customer_type === 'returning' && isNewCustomer) {
        return new Response(
          JSON.stringify({
            valid: false,
            discount: 0,
            finalTotal: cartTotal,
            error: 'This coupon is for returning customers only'
          } as ValidateCouponResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 7. Check first order only flag
    if (coupon.is_first_order) {
      const { data: orders } = await supabase
        .from('orders')
        .select('id', { count: 'exact' })
        .eq('store_id', storeId)
        .or(`customer_phone.eq.${customerPhone},customer_email.eq.${customerEmail || ''}`)
        .limit(1)

      const isNewCustomer = !orders || orders.length === 0
      if (!isNewCustomer) {
        return new Response(
          JSON.stringify({
            valid: false,
            discount: 0,
            finalTotal: cartTotal,
            error: 'This coupon is for first-time customers only'
          } as ValidateCouponResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 8. Check total usage limit (ATOMIC CHECK)
    if (coupon.usage_limit_total) {
      const { data: usageData, error: usageError } = await supabase
        .from('coupon_usage')
        .select('id', { count: 'exact' })
        .eq('coupon_id', coupon.id)

      const usageCount = usageData?.length || 0
      if (usageCount >= coupon.usage_limit_total) {
        return new Response(
          JSON.stringify({
            valid: false,
            discount: 0,
            finalTotal: cartTotal,
            error: 'Coupon usage limit exceeded'
          } as ValidateCouponResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 9. Check per-customer usage limit (ATOMIC CHECK)
    if (coupon.usage_limit_per_customer) {
      let usagePerCustomer = 0

      if (customerPhone) {
        const { data: usageData } = await supabase
          .from('coupon_usage')
          .select('id', { count: 'exact' })
          .eq('coupon_id', coupon.id)
          .eq('customer_phone', customerPhone)

        usagePerCustomer = usageData?.length || 0
      }

      if (usagePerCustomer === 0 && customerEmail) {
        const { data: usageData } = await supabase
          .from('coupon_usage')
          .select('id', { count: 'exact' })
          .eq('coupon_id', coupon.id)
          .eq('customer_email', customerEmail)

        usagePerCustomer = usageData?.length || 0
      }

      if (usagePerCustomer >= coupon.usage_limit_per_customer) {
        return new Response(
          JSON.stringify({
            valid: false,
            discount: 0,
            finalTotal: cartTotal,
            error: 'You have already used this coupon the maximum number of times'
          } as ValidateCouponResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 10. Calculate discount
    let discount = 0
    if (coupon.discount_type === 'percentage') {
      discount = (cartTotal * coupon.discount_value) / 100
      if (coupon.max_discount && discount > coupon.max_discount) {
        discount = coupon.max_discount
      }
    } else {
      discount = coupon.discount_value
      if (discount > cartTotal) {
        discount = cartTotal
      }
    }

    discount = Math.max(0, discount)
    const finalTotal = Math.max(0, cartTotal - discount)

    return new Response(
      JSON.stringify({
        valid: true,
        discount,
        finalTotal,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value
        }
      } as ValidateCouponResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        valid: false,
        discount: 0,
        finalTotal: 0,
        error: error.message || 'Internal server error'
      } as ValidateCouponResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
