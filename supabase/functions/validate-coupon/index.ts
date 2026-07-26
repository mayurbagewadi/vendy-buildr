import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidateCouponRequest {
  couponCode?: string
  storeId?: string
  cartTotal?: number
  customerPhone?: string
  customerEmail?: string
  selectedPaymentMethod?: string
  cartItems?: Array<{
    id?: string
    productId?: string
    quantity?: number
    variant?: string
  }>
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const jsonResponse = (body: ValidateCouponResponse, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    })

  try {
    let requestBody: ValidateCouponRequest
    try {
      requestBody = await req.json() as ValidateCouponRequest
    } catch (_error) {
      return jsonResponse({
        valid: false,
        discount: 0,
        finalTotal: 0,
        error: 'We could not read this coupon request. Please refresh and try again.',
      })
    }

    const couponCode = (requestBody.couponCode || '').trim().toUpperCase()
    const storeId = (requestBody.storeId || '').trim()
    const cartTotal = Number(requestBody.cartTotal)
    const customerPhone = (requestBody.customerPhone || '').trim()
    const customerEmail = (requestBody.customerEmail || '').trim()
    const selectedPaymentMethod = (requestBody.selectedPaymentMethod || '').trim()
    const cartItems = requestBody.cartItems || []
    const safeCartTotal = Number.isFinite(cartTotal) ? Math.max(0, cartTotal) : 0

    const invalidCoupon = (error: string) =>
      jsonResponse({
        valid: false,
        discount: 0,
        finalTotal: safeCartTotal,
        error,
      })

    if (!couponCode) {
      return invalidCoupon('Please enter a coupon code.')
    }

    if (!storeId) {
      return invalidCoupon('Store information is not ready yet. Please refresh and try again.')
    }

    if (!Number.isFinite(cartTotal) || cartTotal <= 0) {
      return invalidCoupon('Add items to your cart before applying a coupon.')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({
        valid: false,
        discount: 0,
        finalTotal: safeCartTotal,
        error: 'We could not apply this coupon right now. Please refresh and try again.',
      }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .eq('store_id', storeId)
      .eq('code', couponCode)
      .maybeSingle()

    if (couponError) {
      console.error('Error fetching coupon:', couponError)
      return invalidCoupon('We could not apply this coupon right now. Please try again.')
    }

    if (!coupon) {
      return invalidCoupon('Coupon not found.')
    }

    if (coupon.status !== 'active') {
      return invalidCoupon('Coupon is not active.')
    }

    const now = new Date()
    const expiryDate = new Date(coupon.expiry_date)
    if (expiryDate < now) {
      return invalidCoupon('Coupon has expired.')
    }

    const startDate = new Date(coupon.start_date)
    if (startDate > now) {
      return invalidCoupon('Coupon is not active yet.')
    }

    if (coupon.min_order_value && cartTotal < Number(coupon.min_order_value)) {
      return invalidCoupon(`Minimum order value of Rs${coupon.min_order_value} required.`)
    }

    if (coupon.order_type === 'online' && selectedPaymentMethod === 'cod') {
      return invalidCoupon('This coupon is valid only for online payment.')
    }

    if (coupon.order_type === 'cod' && selectedPaymentMethod && selectedPaymentMethod !== 'cod') {
      return invalidCoupon('This coupon is valid only for Cash on Delivery orders.')
    }

    const productIds = cartItems
      .map((item) => item.productId || item.id)
      .filter((id): id is string => Boolean(id))

    if (coupon.applicable_to === 'products') {
      if (productIds.length === 0) {
        return invalidCoupon('Add eligible products to use this coupon.')
      }

      const { data: couponProducts, error: couponProductsError } = await supabase
        .from('coupon_products')
        .select('product_id')
        .eq('coupon_id', coupon.id)
        .eq('is_excluded', false)

      if (couponProductsError) {
        console.error('Error checking coupon products:', couponProductsError)
        return invalidCoupon('We could not apply this coupon right now. Please try again.')
      }

      const eligibleProductIds = new Set((couponProducts || []).map((item) => item.product_id))
      if (!productIds.some((productId) => eligibleProductIds.has(productId))) {
        return invalidCoupon('This coupon is not valid for items in your cart.')
      }
    }

    if (coupon.applicable_to === 'categories') {
      if (productIds.length === 0) {
        return invalidCoupon('Add eligible products to use this coupon.')
      }

      const { data: couponCategories, error: couponCategoriesError } = await supabase
        .from('coupon_categories')
        .select('category_id')
        .eq('coupon_id', coupon.id)

      if (couponCategoriesError) {
        console.error('Error checking coupon categories:', couponCategoriesError)
        return invalidCoupon('We could not apply this coupon right now. Please try again.')
      }

      const categoryIds = (couponCategories || []).map((item) => item.category_id)
      if (categoryIds.length === 0) {
        return invalidCoupon('This coupon is not valid for items in your cart.')
      }

      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('name')
        .in('id', categoryIds)

      if (categoriesError) {
        console.error('Error checking coupon category names:', categoriesError)
        return invalidCoupon('We could not apply this coupon right now. Please try again.')
      }

      const eligibleCategoryNames = new Set((categories || []).map((category) => category.name))
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('category')
        .eq('store_id', storeId)
        .in('id', productIds)

      if (productsError) {
        console.error('Error checking cart product categories:', productsError)
        return invalidCoupon('We could not apply this coupon right now. Please try again.')
      }

      if (!(products || []).some((product) => eligibleCategoryNames.has(product.category))) {
        return invalidCoupon('This coupon is not valid for items in your cart.')
      }
    }

    const needsCustomerIdentity =
      coupon.customer_type !== 'all' ||
      coupon.is_first_order ||
      Boolean(coupon.usage_limit_per_customer)

    if (needsCustomerIdentity && !customerPhone && !customerEmail) {
      return invalidCoupon('Please enter your phone number before applying this coupon.')
    }

    if (coupon.customer_type !== 'all') {
      let query = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)

      if (customerPhone && customerEmail) {
        query = query.or(`customer_phone.eq.${customerPhone},customer_email.eq.${customerEmail}`)
      } else if (customerPhone) {
        query = query.eq('customer_phone', customerPhone)
      } else if (customerEmail) {
        query = query.eq('customer_email', customerEmail)
      }

      const { count, error: ordersError } = await query

      if (ordersError) {
        console.error('Error checking customer orders:', ordersError)
        return invalidCoupon('We could not apply this coupon right now. Please try again.')
      }

      const isNewCustomer = (count ?? 0) === 0

      if (coupon.customer_type === 'new' && !isNewCustomer) {
        return invalidCoupon('This coupon is for new customers only.')
      }

      if (coupon.customer_type === 'returning' && isNewCustomer) {
        return invalidCoupon('This coupon is for returning customers only.')
      }
    }

    if (coupon.is_first_order) {
      let query = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)

      if (customerPhone && customerEmail) {
        query = query.or(`customer_phone.eq.${customerPhone},customer_email.eq.${customerEmail}`)
      } else if (customerPhone) {
        query = query.eq('customer_phone', customerPhone)
      } else if (customerEmail) {
        query = query.eq('customer_email', customerEmail)
      }

      const { count, error: ordersError } = await query

      if (ordersError) {
        console.error('Error checking customer first order:', ordersError)
        return invalidCoupon('We could not apply this coupon right now. Please try again.')
      }

      const isNewCustomer = (count ?? 0) === 0
      if (!isNewCustomer) {
        return invalidCoupon('This coupon is for first-time customers only.')
      }
    }

    if (coupon.usage_limit_total) {
      const { count, error: usageError } = await supabase
        .from('coupon_usage')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)

      if (usageError) {
        console.error('Error checking coupon usage:', usageError)
        return invalidCoupon('We could not apply this coupon right now. Please try again.')
      }

      if ((count ?? 0) >= coupon.usage_limit_total) {
        return invalidCoupon('Coupon usage limit exceeded.')
      }
    }

    if (coupon.usage_limit_per_customer) {
      let usagePerCustomer = 0

      if (customerPhone) {
        const { count, error: usageError } = await supabase
          .from('coupon_usage')
          .select('id', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id)
          .eq('customer_phone', customerPhone)

        if (usageError) {
          console.error('Error checking customer coupon usage:', usageError)
          return invalidCoupon('We could not apply this coupon right now. Please try again.')
        }

        usagePerCustomer = count ?? 0
      }

      if (usagePerCustomer === 0 && customerEmail) {
        const { count, error: usageError } = await supabase
          .from('coupon_usage')
          .select('id', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id)
          .eq('customer_email', customerEmail)

        if (usageError) {
          console.error('Error checking customer coupon email usage:', usageError)
          return invalidCoupon('We could not apply this coupon right now. Please try again.')
        }

        usagePerCustomer = count ?? 0
      }

      if (usagePerCustomer >= coupon.usage_limit_per_customer) {
        return invalidCoupon('You have already used this coupon the maximum number of times.')
      }
    }

    let discount = 0
    if (coupon.discount_type === 'percentage') {
      discount = (cartTotal * Number(coupon.discount_value)) / 100
      if (coupon.max_discount && discount > Number(coupon.max_discount)) {
        discount = Number(coupon.max_discount)
      }
    } else {
      discount = Number(coupon.discount_value)
      if (discount > cartTotal) {
        discount = cartTotal
      }
    }

    discount = Math.max(0, discount)
    const finalTotal = Math.max(0, cartTotal - discount)

    return jsonResponse({
      valid: true,
      discount,
      finalTotal,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: Number(coupon.discount_value),
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return jsonResponse({
      valid: false,
      discount: 0,
      finalTotal: 0,
      error: 'We could not apply this coupon right now. Please try again.',
    }, 500)
  }
})
