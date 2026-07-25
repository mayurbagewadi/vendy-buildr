import { supabase } from "@/integrations/supabase/client";

export interface ShippingShipment {
  id: string;
  order_id: string;
  provider: "delhivery" | "shiprocket";
  awb: string | null;
  status: string;
  tracking_url: string | null;
  last_synced_at: string | null;
  last_error: string | null;
}

interface FunctionErrorWithContext extends Error {
  context?: Response;
}

const callShippingShipmentsFunction = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("shipping-shipments", { body });

  if (error) {
    const response = (error as FunctionErrorWithContext).context;
    if (response instanceof Response) {
      let payload: { error?: string } | null = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (payload?.error) {
        throw new Error(payload.error);
      }
    }
    throw new Error(error.message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
};

export const createDelhiveryShipment = async (
  orderId: string,
): Promise<{ shipment: ShippingShipment; reused?: boolean }> => {
  return callShippingShipmentsFunction({
    action: "create_delhivery_shipment",
    order_id: orderId,
  });
};

export const refreshDelhiveryTracking = async (
  orderId: string,
): Promise<{ shipment: ShippingShipment; cached?: boolean }> => {
  return callShippingShipmentsFunction({
    action: "refresh_delhivery_tracking",
    order_id: orderId,
  });
};
