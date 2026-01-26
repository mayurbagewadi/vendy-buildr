// Utility to add slugs to existing products that don't have them
import { supabase } from "@/integrations/supabase/client";

// Generate URL-friendly slug from product name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

export const migrateProductSlugs = async (storeId: string): Promise<void> => {
  try {
    console.log("[SLUG MIGRATION] Starting migration for store:", storeId);

    // Get all products without slugs
    const { data: products, error: fetchError } = await supabase
      .from("products")
      .select("id, name, slug")
      .eq("store_id", storeId)
      .or("slug.is.null,slug.eq.");

    if (fetchError) {
      console.error("[SLUG MIGRATION] Error fetching products:", fetchError);
      return;
    }

    if (!products || products.length === 0) {
      console.log("[SLUG MIGRATION] No products need slug migration");
      return;
    }

    console.log(`[SLUG MIGRATION] Found ${products.length} products without slugs`);

    // Update each product with a generated slug
    for (const product of products) {
      const slug = generateSlug(product.name);

      const { error: updateError } = await supabase
        .from("products")
        .update({ slug })
        .eq("id", product.id);

      if (updateError) {
        console.error(`[SLUG MIGRATION] Error updating product ${product.id}:`, updateError);
      } else {
        console.log(`[SLUG MIGRATION] ✅ Updated product "${product.name}" with slug: ${slug}`);
      }
    }

    console.log("[SLUG MIGRATION] ✅ Migration completed");
  } catch (error) {
    console.error("[SLUG MIGRATION] Error during migration:", error);
  }
};
