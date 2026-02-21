import { supabase } from "@/integrations/supabase/client";

export interface Coupon {
  id: string;
  store_id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  max_discount?: number;
  min_order_value?: number;
  start_date: string;
  expiry_date: string;
  usage_limit_total?: number;
  usage_limit_per_customer?: number;
  applicable_to: 'all' | 'products' | 'categories';
  customer_type: 'all' | 'new' | 'returning';
  is_first_order: boolean;
  order_type: 'all' | 'online' | 'cod';
  status: 'active' | 'disabled' | 'expired';
  created_at: string;
  updated_at: string;
}

export interface CouponWithProducts extends Coupon {
  coupon_products?: Array<{
    id: string;
    product_id: string;
    is_excluded: boolean;
  }>;
  coupon_categories?: Array<{
    id: string;
    category_id: string;
  }>;
}

export const generateCouponCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const code = Array(8)
    .fill(0)
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join('');
  return code;
};

export const validateCouponCode = (code: string): boolean => {
  return /^[A-Z0-9]{6,20}$/.test(code);
};

export const calculateDiscount = (
  cartTotal: number,
  coupon: Coupon
): { discount: number; finalTotal: number } => {
  let discount = 0;

  // Check minimum order value
  if (coupon.min_order_value && cartTotal < coupon.min_order_value) {
    return { discount: 0, finalTotal: cartTotal };
  }

  if (coupon.discount_type === 'percentage') {
    discount = (cartTotal * coupon.discount_value) / 100;
    if (coupon.max_discount && discount > coupon.max_discount) {
      discount = coupon.max_discount;
    }
  } else {
    discount = coupon.discount_value;
    if (discount > cartTotal) {
      discount = cartTotal;
    }
  }

  return {
    discount: Math.max(0, discount),
    finalTotal: Math.max(0, cartTotal - discount),
  };
};

export const getCouponUsageCount = async (
  couponId: string
): Promise<number> => {
  const { data, error } = await supabase
    .from('coupon_usage')
    .select('id', { count: 'exact' })
    .eq('coupon_id', couponId);

  if (error) throw error;
  return data?.length || 0;
};

export const getCouponUsagePerCustomer = async (
  couponId: string,
  customerEmail: string
): Promise<number> => {
  const { data, error } = await supabase
    .from('coupon_usage')
    .select('id', { count: 'exact' })
    .eq('coupon_id', couponId)
    .eq('customer_email', customerEmail);

  if (error) throw error;
  return data?.length || 0;
};

export const isNewCustomer = async (
  storeId: string,
  customerPhone?: string,
  customerEmail?: string
): Promise<boolean> => {
  try {
    if (!customerPhone && !customerEmail) {
      return true; // No identifying info, treat as new
    }

    // Build query: check if customer has ANY previous orders
    // Search by phone (mandatory) OR email (optional)
    let query = supabase
      .from('orders')
      .select('id', { count: 'exact' })
      .eq('store_id', storeId);

    // Create OR condition for phone or email
    if (customerPhone && customerEmail) {
      query = query.or(
        `customer_phone.eq.${customerPhone},customer_email.eq.${customerEmail}`
      );
    } else if (customerPhone) {
      query = query.eq('customer_phone', customerPhone);
    } else if (customerEmail) {
      query = query.eq('customer_email', customerEmail);
    }

    const { data, error } = await query.limit(1);

    if (error) throw error;

    // If no orders found, customer is new
    return !data || data.length === 0;
  } catch (error: any) {
    console.error('Error checking if customer is new:', error);
    return true; // Default to new customer on error
  }
};

export const validateCoupon = async (
  couponCode: string,
  storeId: string,
  cartTotal: number,
  customerPhone?: string,
  customerEmail?: string
): Promise<{
  valid: boolean;
  coupon?: Coupon;
  error?: string;
}> => {
  try {
    // Fetch coupon
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('store_id', storeId)
      .eq('code', couponCode.toUpperCase())
      .maybeSingle();

    if (error) throw error;

    if (!coupon) {
      return { valid: false, error: 'Coupon not found' };
    }

    // Check if coupon is active
    if (coupon.status !== 'active') {
      return { valid: false, error: 'Coupon is not active' };
    }

    // Check if coupon has expired
    if (new Date(coupon.expiry_date) < new Date()) {
      return { valid: false, error: 'Coupon has expired' };
    }

    // Check if coupon has started
    if (new Date(coupon.start_date) > new Date()) {
      return { valid: false, error: 'Coupon is not yet active' };
    }

    // Check minimum order value
    if (
      coupon.min_order_value &&
      cartTotal < coupon.min_order_value
    ) {
      return {
        valid: false,
        error: `Minimum order value of ₹${coupon.min_order_value} required`,
      };
    }

    // Check customer type targeting (new vs returning)
    if (coupon.customer_type !== 'all') {
      const isNew = await isNewCustomer(storeId, customerPhone, customerEmail);

      if (coupon.customer_type === 'new' && !isNew) {
        return { valid: false, error: 'This coupon is for new customers only' };
      }

      if (coupon.customer_type === 'returning' && isNew) {
        return { valid: false, error: 'This coupon is for returning customers only' };
      }
    }

    // Check first order only flag
    if (coupon.is_first_order) {
      const isNew = await isNewCustomer(storeId, customerPhone, customerEmail);
      if (!isNew) {
        return { valid: false, error: 'This coupon is for first-time customers only' };
      }
    }

    // Check total usage limit
    if (coupon.usage_limit_total) {
      const usageCount = await getCouponUsageCount(coupon.id);
      if (usageCount >= coupon.usage_limit_total) {
        return { valid: false, error: 'Coupon usage limit exceeded' };
      }
    }

    // Check per-customer usage limit (check by phone OR email)
    if (coupon.usage_limit_per_customer && (customerPhone || customerEmail)) {
      let usagePerCustomer = 0;

      if (customerPhone) {
        const { data: usageData } = await supabase
          .from('coupon_usage')
          .select('id', { count: 'exact' })
          .eq('coupon_id', coupon.id)
          .eq('customer_phone', customerPhone);
        usagePerCustomer = usageData?.length || 0;
      }

      // Also check by email if provided and phone didn't find anything
      if (usagePerCustomer === 0 && customerEmail) {
        const { data: usageData } = await supabase
          .from('coupon_usage')
          .select('id', { count: 'exact' })
          .eq('coupon_id', coupon.id)
          .eq('customer_email', customerEmail);
        usagePerCustomer = usageData?.length || 0;
      }

      if (usagePerCustomer >= coupon.usage_limit_per_customer) {
        return {
          valid: false,
          error: 'You have already used this coupon the maximum number of times',
        };
      }
    }

    return { valid: true, coupon: coupon as Coupon };
  } catch (error: any) {
    return { valid: false, error: error.message || 'Error validating coupon' };
  }
};

export const recordCouponUsage = async (
  couponId: string,
  orderId: string,
  customerPhone?: string,
  customerEmail?: string,
  discountApplied?: number
): Promise<void> => {
  const { error } = await supabase
    .from('coupon_usage')
    .insert({
      coupon_id: couponId,
      order_id: orderId,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      discount_applied: discountApplied || 0,
    });

  if (error) throw error;
};

export const getCouponStats = async (storeId: string) => {
  try {
    // Total coupons
    const { data: totalData } = await supabase
      .from('coupons')
      .select('id', { count: 'exact' })
      .eq('store_id', storeId);

    // Active coupons
    const { data: activeData } = await supabase
      .from('coupons')
      .select('id', { count: 'exact' })
      .eq('store_id', storeId)
      .eq('status', 'active');

    // Total usage
    const { data: usageData } = await supabase
      .from('coupon_usage')
      .select('discount_applied')
      .in(
        'coupon_id',
        (
          await supabase
            .from('coupons')
            .select('id')
            .eq('store_id', storeId)
        ).data?.map((c) => c.id) || []
      );

    const totalDiscount = usageData?.reduce(
      (sum, row) => sum + (row.discount_applied || 0),
      0
    ) || 0;

    return {
      totalCoupons: totalData?.length || 0,
      activeCoupons: activeData?.length || 0,
      totalUsage: usageData?.length || 0,
      totalDiscountGiven: totalDiscount,
    };
  } catch (error) {
    console.error('Error getting coupon stats:', error);
    return {
      totalCoupons: 0,
      activeCoupons: 0,
      totalUsage: 0,
      totalDiscountGiven: 0,
    };
  }
};

export interface CouponUsageRecord {
  id: string;
  order_id: string;
  customer_phone?: string;
  customer_email?: string;
  discount_applied: number;
  used_at: string;
  order_number?: string;
}

export const getCouponUsageDetails = async (
  couponId: string
): Promise<CouponUsageRecord[]> => {
  try {
    const { data, error } = await supabase
      .from('coupon_usage')
      .select(`
        id,
        order_id,
        customer_phone,
        customer_email,
        discount_applied,
        used_at,
        orders (order_number)
      `)
      .eq('coupon_id', couponId)
      .order('used_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((record: any) => ({
      id: record.id,
      order_id: record.order_id,
      customer_phone: record.customer_phone,
      customer_email: record.customer_email,
      discount_applied: record.discount_applied,
      used_at: record.used_at,
      order_number: record.orders?.order_number,
    }));
  } catch (error) {
    console.error('Error getting coupon usage details:', error);
    return [];
  }
};
