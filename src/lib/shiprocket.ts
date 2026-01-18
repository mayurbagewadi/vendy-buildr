// Shiprocket API Integration via Supabase Edge Function
// This avoids CORS issues by routing through our backend

import { supabase } from "@/integrations/supabase/client";

interface ShiprocketAuthResponse {
  token: string;
  company_id: number;
  email: string;
  first_name: string;
  last_name: string;
  id: number;
}

interface OrderItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
  discount?: number;
  tax?: number;
  hsn?: string;
}

interface ShiprocketOrderData {
  order_id: string;
  order_date: string;
  pickup_location: string;
  billing_customer_name: string;
  billing_last_name?: string;
  billing_address: string;
  billing_address_2?: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: string;
  billing_email?: string;
  billing_phone: string;
  shipping_is_billing: boolean;
  shipping_customer_name?: string;
  shipping_last_name?: string;
  shipping_address?: string;
  shipping_address_2?: string;
  shipping_city?: string;
  shipping_pincode?: string;
  shipping_state?: string;
  shipping_country?: string;
  shipping_email?: string;
  shipping_phone?: string;
  order_items: OrderItem[];
  payment_method: "Prepaid" | "COD";
  sub_total: number;
  length: number;
  breadth: number;
  height: number;
  weight: number;
}

interface ShiprocketCreateOrderResponse {
  order_id: number;
  shipment_id: number;
  status: string;
  status_code: number;
  onboarding_completed_now: number;
  awb_code: string | null;
  courier_company_id: string | null;
  courier_name: string | null;
}

interface CourierServiceability {
  courier_company_id: number;
  courier_name: string;
  freight_charge: number;
  cod_charges: number;
  etd: string;
  estimated_delivery_days: number;
}

// Call the Shiprocket edge function
const callShiprocketFunction = async (body: any) => {
  const { data, error } = await supabase.functions.invoke('shiprocket', {
    body,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

// Authenticate with Shiprocket and get token
export const shiprocketLogin = async (
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> => {
  try {
    const data = await callShiprocketFunction({
      action: "login",
      email,
      password,
    });

    if (data.token) {
      return { success: true, token: data.token };
    } else {
      return {
        success: false,
        error: data.message || "Authentication failed",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Network error",
    };
  }
};

// Get pickup locations
export const shiprocketGetPickupLocations = async (
  token: string
): Promise<{ success: boolean; locations?: any[]; error?: string }> => {
  try {
    const data = await callShiprocketFunction({
      action: "get_pickup_locations",
      token,
    });

    if (data.data?.shipping_address) {
      return { success: true, locations: data.data.shipping_address };
    } else {
      return {
        success: false,
        error: data.message || "Failed to get pickup locations",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Network error",
    };
  }
};

// Create order in Shiprocket
export const shiprocketCreateOrder = async (
  token: string,
  orderData: ShiprocketOrderData
): Promise<{ success: boolean; data?: ShiprocketCreateOrderResponse; error?: string }> => {
  try {
    const result = await callShiprocketFunction({
      action: "create_order",
      token,
      data: orderData,
    });

    if (result.order_id) {
      return { success: true, data: result };
    } else {
      return {
        success: false,
        error: result.message || "Failed to create order",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Network error",
    };
  }
};

// Get available couriers for a shipment
export const shiprocketGetCouriers = async (
  token: string,
  pickupPincode: string,
  deliveryPincode: string,
  weight: number,
  cod: boolean = false
): Promise<{ success: boolean; couriers?: CourierServiceability[]; error?: string }> => {
  try {
    const data = await callShiprocketFunction({
      action: "get_couriers",
      token,
      data: {
        pickup_postcode: pickupPincode,
        delivery_postcode: deliveryPincode,
        weight,
        cod,
      },
    });

    if (data.data?.available_courier_companies) {
      return {
        success: true,
        couriers: data.data.available_courier_companies,
      };
    } else {
      return {
        success: false,
        error: data.message || "Failed to get couriers",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Network error",
    };
  }
};

// Generate AWB (Airway Bill) for shipment
export const shiprocketGenerateAWB = async (
  token: string,
  shipmentId: number,
  courierId: number
): Promise<{ success: boolean; awbCode?: string; error?: string }> => {
  try {
    const data = await callShiprocketFunction({
      action: "generate_awb",
      token,
      data: {
        shipment_id: shipmentId,
        courier_id: courierId,
      },
    });

    if (data.response?.data?.awb_code) {
      return { success: true, awbCode: data.response.data.awb_code };
    } else {
      return {
        success: false,
        error: data.message || "Failed to generate AWB",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Network error",
    };
  }
};

// Get tracking details
export const shiprocketGetTracking = async (
  token: string,
  awbCode: string
): Promise<{ success: boolean; tracking?: any; error?: string }> => {
  try {
    const data = await callShiprocketFunction({
      action: "get_tracking",
      token,
      data: { awb_code: awbCode },
    });

    if (data.tracking_data) {
      return { success: true, tracking: data.tracking_data };
    } else {
      return {
        success: false,
        error: data.message || "Failed to get tracking",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Network error",
    };
  }
};

// Request pickup for shipment
export const shiprocketRequestPickup = async (
  token: string,
  shipmentId: number
): Promise<{ success: boolean; pickupStatus?: string; error?: string }> => {
  try {
    const data = await callShiprocketFunction({
      action: "request_pickup",
      token,
      data: { shipment_id: shipmentId },
    });

    return { success: true, pickupStatus: data.pickup_status };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Network error",
    };
  }
};

// Cancel shipment
export const shiprocketCancelShipment = async (
  token: string,
  awbCodes: string[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    await callShiprocketFunction({
      action: "cancel_shipment",
      token,
      data: { awbs: awbCodes },
    });

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Network error",
    };
  }
};

// Helper: Convert platform order to Shiprocket format
export const convertToShiprocketOrder = (
  order: any,
  pickupLocation: string,
  packageDimensions: { length: number; breadth: number; height: number; weight: number }
): ShiprocketOrderData => {
  const nameParts = (order.customer_name || "Customer").split(" ");
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Parse address to extract city, state, pincode
  const address = order.delivery_address || "";
  const pincode = order.delivery_pincode || "";

  return {
    order_id: order.order_number || order.id,
    order_date: new Date(order.created_at).toISOString().split("T")[0],
    pickup_location: pickupLocation,
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: address,
    billing_city: order.delivery_city || "City",
    billing_pincode: pincode,
    billing_state: order.delivery_state || "State",
    billing_country: "India",
    billing_email: order.customer_email || "",
    billing_phone: order.customer_phone || "",
    shipping_is_billing: true,
    order_items: (order.items || []).map((item: any) => ({
      name: item.name || item.product_name || "Product",
      sku: item.sku || item.id || `SKU-${Date.now()}`,
      units: item.quantity || 1,
      selling_price: item.price || 0,
      discount: 0,
      tax: 0,
    })),
    payment_method: order.payment_method === "cod" ? "COD" : "Prepaid",
    sub_total: order.total || order.subtotal || 0,
    length: packageDimensions.length,
    breadth: packageDimensions.breadth,
    height: packageDimensions.height,
    weight: packageDimensions.weight,
  };
};
