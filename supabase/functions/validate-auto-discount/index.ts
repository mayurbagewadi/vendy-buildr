import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  categoryId?: string
  storeId: string
}

interface ValidateAutoDiscountRequest {
  storeId: string
  cartItems: CartItem[]
  cartTotal: number
  selectedPaymentMethod: string
  customerPhone?: string
  customerEmail?: string
}

interface AutoDiscountResponse {
  applicable: boolean
  id?: string
  ruleName?: string
  discount: number
  discountType?: 'percentage' | 'flat'
  discountValue?: number
  discountPercentage?: number
  error?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { storeId, cartItems, cartTotal, selectedPaymentMethod, customerPhone, customerEmail } =
      await req.json() as ValidateAutoDiscountRequest

    // Validate input
    if (!storeId || !cartItems || !cartTotal || !selectedPaymentMethod) {
      return new Response(
        JSON.stringify({
          applicable: false,
          discount: 0,
          error: 'Missing required fields'
        } as AutoDiscountResponse),
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
          applicable: false,
          discount: 0,
          error: 'Unauthorized'
        } as AutoDiscountResponse),
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

    // Get all active automatic discount rules for the store
    const { data: discounts, error: discountsError } = await supabase
      .from('automatic_discounts')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'active')

    if (discountsError) throw discountsError

    if (!discounts || discounts.length === 0) {
      return new Response(
        JSON.stringify({
          applicable: false,
          discount: 0
        } as AutoDiscountResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const now = new Date()
    let bestDiscount: AutoDiscountResponse = { applicable: false, discount: 0 }

    // Evaluate each discount rule
    for (const discount of discounts) {
      // Check if discount is valid (not expired, started)
      const startDate = new Date(discount.start_date)
      const expiryDate = new Date(discount.expiry_date)

      if (startDate > now || expiryDate <= now) {
        continue // Skip expired or not-yet-active discounts
      }

      // Check payment method compatibility
      if (discount.order_type !== 'all') {
        if (discount.order_type === 'online' && selectedPaymentMethod === 'cod') {
          continue
        }
        if (discount.order_type === 'cod' && selectedPaymentMethod !== 'cod') {
          continue
        }
      }

      let result: { applicable: boolean; discount: number; ruleName: string; discountType: 'percentage' | 'flat'; discountValue: number } | null = null

      // Evaluate based on rule type
      if (discount.rule_type === 'tiered_value') {
        result = await evaluateTieredDiscount(supabase, discount.id, cartTotal, discount.rule_name)
      } else if (discount.rule_type === 'new_customer') {
        result = await evaluateNewCustomerDiscount(supabase, discount.id, storeId, cartTotal, customerPhone, customerEmail, discount.rule_name)
      } else if (discount.rule_type === 'returning_customer') {
        result = await evaluateReturningCustomerDiscount(supabase, discount.id, storeId, cartTotal, customerPhone, customerEmail, discount.rule_name)
      } else if (discount.rule_type === 'category') {
        result = await evaluateCategoryDiscount(supabase, discount.id, cartItems, cartTotal, discount.rule_name)
      } else if (discount.rule_type === 'quantity') {
        result = await evaluateQuantityDiscount(supabase, discount.id, cartItems, cartTotal, discount.rule_name)
      }

      // Keep the discount with highest amount
      if (result && result.applicable && result.discount > bestDiscount.discount) {
        bestDiscount = {
          applicable: true,
          id: discount.id,
          ruleName: result.ruleName,
          discount: result.discount,
          discountType: result.discountType,
          discountValue: result.discountValue,
          discountPercentage: result.discountType === 'percentage' ? result.discountValue : undefined
        }
      }
    }

    return new Response(
      JSON.stringify(bestDiscount),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        applicable: false,
        discount: 0,
        error: error.message || 'Internal server error'
      } as AutoDiscountResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

// Evaluate tiered discount
async function evaluateTieredDiscount(
  supabase: any,
  discountId: string,
  cartTotal: number,
  ruleName: string
): Promise<{ applicable: boolean; discount: number; ruleName: string; discountType: 'percentage' | 'flat'; discountValue: number } | null> {
  try {
    const { data: tiers, error } = await supabase
      .from('discount_tiers')
      .select('*')
      .eq('discount_id', discountId)
      .order('tier_order', { ascending: true })

    if (error) throw error

    if (!tiers || tiers.length === 0) {
      return null
    }

    // Find highest tier that matches
    let matchedTier = null
    for (const tier of tiers) {
      if (tier.min_order_value && cartTotal >= tier.min_order_value) {
        matchedTier = tier
      }
    }

    if (!matchedTier) {
      return null
    }

    const discountAmount = calculateDiscountAmount(cartTotal, matchedTier.discount_type, matchedTier.discount_value)

    return {
      applicable: true,
      discount: discountAmount,
      ruleName: ruleName,
      discountType: matchedTier.discount_type,
      discountValue: matchedTier.discount_value
    }
  } catch (error) {
    console.error('Error evaluating tiered discount:', error)
    return null
  }
}

// Evaluate new customer discount
async function evaluateNewCustomerDiscount(
  supabase: any,
  discountId: string,
  storeId: string,
  cartTotal: number,
  customerPhone?: string,
  customerEmail?: string,
  ruleName?: string
): Promise<{ applicable: boolean; discount: number; ruleName: string; discountType: 'percentage' | 'flat'; discountValue: number } | null> {
  try {
    // Check if customer is new
    if (!customerPhone && !customerEmail) {
      return null // No identifying info
    }

    let query = supabase
      .from('orders')
      .select('id', { count: 'exact' })
      .eq('store_id', storeId)

    if (customerPhone && customerEmail) {
      query = query.or(`customer_phone.eq.${customerPhone},customer_email.eq.${customerEmail}`)
    } else if (customerPhone) {
      query = query.eq('customer_phone', customerPhone)
    } else if (customerEmail) {
      query = query.eq('customer_email', customerEmail)
    }

    const { data: orders, error } = await query.limit(1)

    if (error) throw error

    const isNewCustomer = !orders || orders.length === 0

    if (!isNewCustomer) {
      return null
    }

    // Get the discount rule
    const { data: rules, error: rulesError } = await supabase
      .from('discount_rules')
      .select('*')
      .eq('discount_id', discountId)

    if (rulesError) throw rulesError

    if (!rules || rules.length === 0) {
      return null
    }

    const rule = rules[0]
    const discountAmount = calculateDiscountAmount(cartTotal, rule.discount_type, rule.discount_value)

    return {
      applicable: true,
      discount: discountAmount,
      ruleName: ruleName || 'New Customer Discount',
      discountType: rule.discount_type,
      discountValue: rule.discount_value
    }
  } catch (error) {
    console.error('Error evaluating new customer discount:', error)
    return null
  }
}

// Evaluate returning customer discount
async function evaluateReturningCustomerDiscount(
  supabase: any,
  discountId: string,
  storeId: string,
  cartTotal: number,
  customerPhone?: string,
  customerEmail?: string,
  ruleName?: string
): Promise<{ applicable: boolean; discount: number; ruleName: string; discountType: 'percentage' | 'flat'; discountValue: number } | null> {
  try {
    // Check if customer has orders
    if (!customerPhone && !customerEmail) {
      return null
    }

    let query = supabase
      .from('orders')
      .select('id', { count: 'exact' })
      .eq('store_id', storeId)

    if (customerPhone && customerEmail) {
      query = query.or(`customer_phone.eq.${customerPhone},customer_email.eq.${customerEmail}`)
    } else if (customerPhone) {
      query = query.eq('customer_phone', customerPhone)
    } else if (customerEmail) {
      query = query.eq('customer_email', customerEmail)
    }

    const { data: orders, error } = await query.limit(1)

    if (error) throw error

    const isReturningCustomer = orders && orders.length > 0

    if (!isReturningCustomer) {
      return null
    }

    // Get the discount rule
    const { data: rules, error: rulesError } = await supabase
      .from('discount_rules')
      .select('*')
      .eq('discount_id', discountId)

    if (rulesError) throw rulesError

    if (!rules || rules.length === 0) {
      return null
    }

    const rule = rules[0]
    const discountAmount = calculateDiscountAmount(cartTotal, rule.discount_type, rule.discount_value)

    return {
      applicable: true,
      discount: discountAmount,
      ruleName: ruleName || 'Returning Customer Discount',
      discountType: rule.discount_type,
      discountValue: rule.discount_value
    }
  } catch (error) {
    console.error('Error evaluating returning customer discount:', error)
    return null
  }
}

// Evaluate category-based discount
async function evaluateCategoryDiscount(
  supabase: any,
  discountId: string,
  cartItems: any[],
  cartTotal: number,
  ruleName?: string
): Promise<{ applicable: boolean; discount: number; ruleName: string; discountType: 'percentage' | 'flat'; discountValue: number } | null> {
  try {
    const cartCategories = [...new Set(cartItems.map(item => item.categoryId).filter(Boolean))]

    if (cartCategories.length === 0) {
      return null
    }

    // Get the discount rules
    const { data: rules, error } = await supabase
      .from('discount_rules')
      .select('*')
      .eq('discount_id', discountId)

    if (error) throw error

    if (!rules || rules.length === 0) {
      return null
    }

    // Check if any cart category matches
    const matchedRule = rules.find((rule: any) => cartCategories.includes(rule.rule_value))

    if (!matchedRule) {
      return null
    }

    // Calculate discount only on items in that category
    const categoryTotal = cartItems
      .filter(item => item.categoryId === matchedRule.rule_value)
      .reduce((sum, item) => sum + (item.price * item.quantity), 0)

    const discountAmount = calculateDiscountAmount(categoryTotal, matchedRule.discount_type, matchedRule.discount_value)

    return {
      applicable: true,
      discount: discountAmount,
      ruleName: ruleName || 'Category Discount',
      discountType: matchedRule.discount_type,
      discountValue: matchedRule.discount_value
    }
  } catch (error) {
    console.error('Error evaluating category discount:', error)
    return null
  }
}

// Evaluate quantity-based discount
async function evaluateQuantityDiscount(
  supabase: any,
  discountId: string,
  cartItems: any[],
  cartTotal: number,
  ruleName?: string
): Promise<{ applicable: boolean; discount: number; ruleName: string; discountType: 'percentage' | 'flat'; discountValue: number } | null> {
  try {
    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

    // Get the discount rule
    const { data: rules, error } = await supabase
      .from('discount_rules')
      .select('*')
      .eq('discount_id', discountId)

    if (error) throw error

    if (!rules || rules.length === 0) {
      return null
    }

    const rule = rules[0]
    const minQuantity = parseInt(rule.rule_value, 10)

    if (itemCount < minQuantity) {
      return null
    }

    const discountAmount = calculateDiscountAmount(cartTotal, rule.discount_type, rule.discount_value)

    return {
      applicable: true,
      discount: discountAmount,
      ruleName: ruleName || 'Quantity Discount',
      discountType: rule.discount_type,
      discountValue: rule.discount_value
    }
  } catch (error) {
    console.error('Error evaluating quantity discount:', error)
    return null
  }
}

// Calculate discount amount
function calculateDiscountAmount(
  baseAmount: number,
  discountType: 'percentage' | 'flat',
  discountValue: number
): number {
  if (discountType === 'percentage') {
    return (baseAmount * discountValue) / 100
  } else {
    return Math.min(discountValue, baseAmount)
  }
}
