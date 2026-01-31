import { supabase } from "@/integrations/supabase/client";

export interface AutoDiscount {
  id: string;
  store_id: string;
  rule_name: string;
  rule_description?: string;
  rule_type: 'tiered_value' | 'new_customer' | 'returning_customer' | 'category' | 'quantity';
  order_type: 'all' | 'online' | 'cod';
  status: 'active' | 'disabled';
  start_date: string;
  expiry_date: string;
  created_at: string;
  updated_at: string;
}

export interface DiscountTier {
  id: string;
  discount_id: string;
  tier_order: number;
  min_order_value?: number;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  created_at: string;
}

export interface DiscountRule {
  id: string;
  discount_id: string;
  rule_type: string;
  rule_value: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  created_at: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  categoryId?: string;
  storeId: string;
}

export interface AutoDiscountResult {
  applicable: boolean;
  ruleName?: string;
  discount: number;
  discountType?: 'percentage' | 'flat';
  discountValue?: number;
  discountPercentage?: number;
}

// Get all active automatic discount rules for a store
export const getActiveAutoDiscounts = async (storeId: string): Promise<AutoDiscount[]> => {
  try {
    const { data, error } = await supabase
      .from('automatic_discounts')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching automatic discounts:', error);
    return [];
  }
};

// Get tiers for a tiered discount rule
export const getDiscountTiers = async (discountId: string): Promise<DiscountTier[]> => {
  try {
    const { data, error } = await supabase
      .from('discount_tiers')
      .select('*')
      .eq('discount_id', discountId)
      .order('tier_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching discount tiers:', error);
    return [];
  }
};

// Get rules for a non-tiered discount
export const getDiscountRules = async (discountId: string): Promise<DiscountRule[]> => {
  try {
    const { data, error } = await supabase
      .from('discount_rules')
      .select('*')
      .eq('discount_id', discountId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching discount rules:', error);
    return [];
  }
};

// Check if customer is new
export const isNewCustomer = async (
  storeId: string,
  customerPhone?: string,
  customerEmail?: string
): Promise<boolean> => {
  try {
    if (!customerPhone && !customerEmail) {
      return true; // No identifying info, treat as new
    }

    let query = supabase
      .from('orders')
      .select('id', { count: 'exact' })
      .eq('store_id', storeId);

    if (customerPhone && customerEmail) {
      query = query.or(`customer_phone.eq.${customerPhone},customer_email.eq.${customerEmail}`);
    } else if (customerPhone) {
      query = query.eq('customer_phone', customerPhone);
    } else if (customerEmail) {
      query = query.eq('customer_email', customerEmail);
    }

    const { data, error } = await query.limit(1);

    if (error) throw error;
    return !data || data.length === 0;
  } catch (error) {
    console.error('Error checking if customer is new:', error);
    return true;
  }
};

// Check if customer is returning (has made a purchase)
export const isReturningCustomer = async (
  storeId: string,
  customerPhone?: string,
  customerEmail?: string
): Promise<boolean> => {
  const isNew = await isNewCustomer(storeId, customerPhone, customerEmail);
  return !isNew;
};

// Get product categories from cart
export const getCartCategories = (cart: CartItem[]): string[] => {
  return [...new Set(cart.map(item => item.categoryId).filter(Boolean))] as string[];
};

// Get total item count in cart
export const getCartItemCount = (cart: CartItem[]): number => {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
};

// Calculate cart total
export const getCartTotal = (cart: CartItem[]): number => {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
};

// Check if discount rule is valid (not expired, started)
export const isDiscountValid = (discount: AutoDiscount): boolean => {
  const now = new Date();
  const startDate = new Date(discount.start_date);
  const expiryDate = new Date(discount.expiry_date);

  return startDate <= now && expiryDate > now;
};

// Check payment method compatibility
export const isPaymentMethodCompatible = (
  orderType: 'all' | 'online' | 'cod',
  selectedPaymentMethod: string
): boolean => {
  if (orderType === 'all') return true;
  if (orderType === 'online') return selectedPaymentMethod !== 'cod';
  if (orderType === 'cod') return selectedPaymentMethod === 'cod';
  return false;
};

// Evaluate tiered discount
export const evaluateTieredDiscount = async (
  discountId: string,
  cartTotal: number
): Promise<{ applicable: boolean; tier?: DiscountTier; discount: number }> => {
  try {
    const tiers = await getDiscountTiers(discountId);

    if (tiers.length === 0) {
      return { applicable: false, discount: 0 };
    }

    // Find highest tier that matches
    let matchedTier: DiscountTier | null = null;
    for (const tier of tiers) {
      if (tier.min_order_value && cartTotal >= tier.min_order_value) {
        matchedTier = tier;
      }
    }

    if (!matchedTier) {
      return { applicable: false, discount: 0 };
    }

    const discountAmount = calculateDiscountAmount(cartTotal, matchedTier.discount_type, matchedTier.discount_value);

    return {
      applicable: true,
      tier: matchedTier,
      discount: discountAmount,
    };
  } catch (error) {
    console.error('Error evaluating tiered discount:', error);
    return { applicable: false, discount: 0 };
  }
};

// Evaluate new customer discount
export const evaluateNewCustomerDiscount = async (
  discountId: string,
  storeId: string,
  customerPhone?: string,
  customerEmail?: string
): Promise<{ applicable: boolean; rule?: DiscountRule; discount: number }> => {
  try {
    const isNew = await isNewCustomer(storeId, customerPhone, customerEmail);

    if (!isNew) {
      return { applicable: false, discount: 0 };
    }

    const rules = await getDiscountRules(discountId);
    const rule = rules[0]; // Should be only one rule for new customer discount

    if (!rule) {
      return { applicable: false, discount: 0 };
    }

    return {
      applicable: true,
      rule: rule,
      discount: 0, // Will be calculated later with cart total
    };
  } catch (error) {
    console.error('Error evaluating new customer discount:', error);
    return { applicable: false, discount: 0 };
  }
};

// Evaluate returning customer discount
export const evaluateReturningCustomerDiscount = async (
  discountId: string,
  storeId: string,
  cartTotal: number,
  customerPhone?: string,
  customerEmail?: string
): Promise<{ applicable: boolean; rule?: DiscountRule; discount: number }> => {
  try {
    const isReturning = await isReturningCustomer(storeId, customerPhone, customerEmail);

    if (!isReturning) {
      return { applicable: false, discount: 0 };
    }

    const rules = await getDiscountRules(discountId);
    const rule = rules[0];

    if (!rule) {
      return { applicable: false, discount: 0 };
    }

    const discountAmount = calculateDiscountAmount(cartTotal, rule.discount_type, rule.discount_value);

    return {
      applicable: true,
      rule: rule,
      discount: discountAmount,
    };
  } catch (error) {
    console.error('Error evaluating returning customer discount:', error);
    return { applicable: false, discount: 0 };
  }
};

// Evaluate category-based discount
export const evaluateCategoryDiscount = async (
  discountId: string,
  cart: CartItem[],
  cartTotal: number
): Promise<{ applicable: boolean; rule?: DiscountRule; discount: number }> => {
  try {
    const cartCategories = getCartCategories(cart);
    const rules = await getDiscountRules(discountId);

    // Check if any cart category matches the rule
    const matchedRule = rules.find(rule =>
      cartCategories.includes(rule.rule_value)
    );

    if (!matchedRule) {
      return { applicable: false, discount: 0 };
    }

    // Calculate discount only on items in that category
    const categoryTotal = cart
      .filter(item => item.categoryId === matchedRule.rule_value)
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const discountAmount = calculateDiscountAmount(categoryTotal, matchedRule.discount_type, matchedRule.discount_value);

    return {
      applicable: true,
      rule: matchedRule,
      discount: discountAmount,
    };
  } catch (error) {
    console.error('Error evaluating category discount:', error);
    return { applicable: false, discount: 0 };
  }
};

// Evaluate quantity-based discount
export const evaluateQuantityDiscount = async (
  discountId: string,
  cart: CartItem[],
  cartTotal: number
): Promise<{ applicable: boolean; rule?: DiscountRule; discount: number }> => {
  try {
    const itemCount = getCartItemCount(cart);
    const rules = await getDiscountRules(discountId);
    const rule = rules[0];

    if (!rule) {
      return { applicable: false, discount: 0 };
    }

    const minQuantity = parseInt(rule.rule_value, 10);

    if (itemCount < minQuantity) {
      return { applicable: false, discount: 0 };
    }

    const discountAmount = calculateDiscountAmount(cartTotal, rule.discount_type, rule.discount_value);

    return {
      applicable: true,
      rule: rule,
      discount: discountAmount,
    };
  } catch (error) {
    console.error('Error evaluating quantity discount:', error);
    return { applicable: false, discount: 0 };
  }
};

// Calculate discount amount
export const calculateDiscountAmount = (
  baseAmount: number,
  discountType: 'percentage' | 'flat',
  discountValue: number
): number => {
  if (discountType === 'percentage') {
    return (baseAmount * discountValue) / 100;
  } else {
    return Math.min(discountValue, baseAmount); // Can't exceed cart total
  }
};

// Main function: Evaluate all auto discounts and return best one
export const evaluateAutoDiscount = async (
  storeId: string,
  cart: CartItem[],
  selectedPaymentMethod: string,
  customerPhone?: string,
  customerEmail?: string
): Promise<AutoDiscountResult> => {
  try {
    if (cart.length === 0) {
      return { applicable: false, discount: 0 };
    }

    const cartTotal = getCartTotal(cart);
    const discounts = await getActiveAutoDiscounts(storeId);

    if (discounts.length === 0) {
      return { applicable: false, discount: 0 };
    }

    let bestDiscount: AutoDiscountResult = { applicable: false, discount: 0 };

    // Evaluate each discount rule
    for (const discount of discounts) {
      // Check if discount is valid (not expired, started)
      if (!isDiscountValid(discount)) {
        continue;
      }

      // Check payment method compatibility
      if (!isPaymentMethodCompatible(discount.order_type, selectedPaymentMethod)) {
        continue;
      }

      let result: { applicable: boolean; discount: number; tier?: DiscountTier; rule?: DiscountRule } = {
        applicable: false,
        discount: 0,
      };

      // Evaluate based on rule type
      if (discount.rule_type === 'tiered_value') {
        result = await evaluateTieredDiscount(discount.id, cartTotal);
      } else if (discount.rule_type === 'new_customer') {
        const tierResult = await evaluateNewCustomerDiscount(discount.id, storeId, customerPhone, customerEmail);
        if (tierResult.applicable) {
          const discountAmount = calculateDiscountAmount(cartTotal, tierResult.rule!.discount_type, tierResult.rule!.discount_value);
          result = { ...tierResult, discount: discountAmount };
        }
      } else if (discount.rule_type === 'returning_customer') {
        result = await evaluateReturningCustomerDiscount(discount.id, storeId, cartTotal, customerPhone, customerEmail);
      } else if (discount.rule_type === 'category') {
        result = await evaluateCategoryDiscount(discount.id, cart, cartTotal);
      } else if (discount.rule_type === 'quantity') {
        result = await evaluateQuantityDiscount(discount.id, cart, cartTotal);
      }

      // Keep the discount with highest amount
      if (result.applicable && result.discount > bestDiscount.discount) {
        let discountValue = 0;
        let discountPercentage = 0;
        let discountType: 'percentage' | 'flat' = 'flat';

        if (result.tier) {
          discountType = result.tier.discount_type;
          discountValue = result.tier.discount_value;
          if (discountType === 'percentage') {
            discountPercentage = discountValue;
          }
        } else if (result.rule) {
          discountType = result.rule.discount_type;
          discountValue = result.rule.discount_value;
          if (discountType === 'percentage') {
            discountPercentage = discountValue;
          }
        }

        bestDiscount = {
          applicable: true,
          ruleName: discount.rule_name,
          discount: result.discount,
          discountType,
          discountValue,
          discountPercentage,
        };
      }
    }

    return bestDiscount;
  } catch (error) {
    console.error('Error evaluating auto discount:', error);
    return { applicable: false, discount: 0 };
  }
};

// Get auto discount stats for dashboard
export const getAutoDiscountStats = async (storeId: string) => {
  try {
    // Total rules
    const { data: totalData } = await supabase
      .from('automatic_discounts')
      .select('id', { count: 'exact' })
      .eq('store_id', storeId);

    // Active rules
    const { data: activeData } = await supabase
      .from('automatic_discounts')
      .select('id', { count: 'exact' })
      .eq('store_id', storeId)
      .eq('status', 'active');

    return {
      totalRules: totalData?.length || 0,
      activeRules: activeData?.length || 0,
    };
  } catch (error) {
    console.error('Error getting auto discount stats:', error);
    return {
      totalRules: 0,
      activeRules: 0,
    };
  }
};
