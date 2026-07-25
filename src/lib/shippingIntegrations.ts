import { supabase } from "@/integrations/supabase/client";

export type ShippingProvider = "delhivery";
export type ShippingEnvironment = "production" | "staging";

export interface ShippingIntegration {
  id: string;
  store_id: string;
  provider: ShippingProvider;
  environment: ShippingEnvironment;
  display_name: string | null;
  token_last4: string | null;
  auth_scheme: string;
  client_name: string | null;
  pickup_location: string | null;
  enabled: boolean;
  status: "not_connected" | "connected" | "invalid" | "disabled";
  last_tested_at: string | null;
  last_error: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface FunctionErrorWithContext extends Error {
  context?: Response;
}

const callShippingIntegrationsFunction = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("shipping-integrations", { body });

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

export const getShippingIntegrations = async (
  storeId: string,
): Promise<{ integrations: ShippingIntegration[] }> => {
  return callShippingIntegrationsFunction({
    action: "get_integrations",
    store_id: storeId,
  });
};

export const saveDelhiveryIntegration = async (params: {
  storeId: string;
  apiToken: string;
  clientName?: string;
  pickupLocation?: string;
  environment: ShippingEnvironment;
}): Promise<{ integration: ShippingIntegration }> => {
  return callShippingIntegrationsFunction({
    action: "save_delhivery_token",
    store_id: params.storeId,
    api_token: params.apiToken,
    client_name: params.clientName,
    pickup_location: params.pickupLocation,
    environment: params.environment,
  });
};

export const testShippingProvider = async (
  storeId: string,
  provider: ShippingProvider,
): Promise<{ integration: ShippingIntegration }> => {
  return callShippingIntegrationsFunction({
    action: "test_provider",
    store_id: storeId,
    provider,
  });
};

export const toggleShippingProvider = async (
  storeId: string,
  provider: ShippingProvider,
  enabled: boolean,
): Promise<{ integration: ShippingIntegration }> => {
  return callShippingIntegrationsFunction({
    action: "toggle_provider",
    store_id: storeId,
    provider,
    enabled,
  });
};

export const disconnectShippingProvider = async (
  storeId: string,
  provider: ShippingProvider,
): Promise<{ success: boolean }> => {
  return callShippingIntegrationsFunction({
    action: "disconnect_provider",
    store_id: storeId,
    provider,
  });
};
