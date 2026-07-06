import { supabase } from "@/integrations/supabase/client";

export type PublicStorefrontCategory = {
  id: string;
  name: string;
  image_url: string | null;
  store_id: string;
  created_at?: string | null;
};

const PUBLIC_CATEGORY_COLUMNS = "id, name, image_url, store_id, created_at";

export const getPublicStoreCategories = async (
  storeId: string,
  limit = 50
): Promise<PublicStorefrontCategory[]> => {
  const { data, error } = await supabase
    .from("categories")
    .select(PUBLIC_CATEGORY_COLUMNS)
    .eq("store_id", storeId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching public storefront categories:", error);
    return [];
  }

  return (data ?? []) as PublicStorefrontCategory[];
};
