// Utility to seed demo products and categories for a store
import { supabase } from "@/integrations/supabase/client";
import { DEMO_PRODUCTS, DEMO_CATEGORIES } from "./demoProducts";

// Generate URL-friendly slug from product name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

export const seedDemoDataForStore = async (storeId: string): Promise<boolean> => {
  try {
    console.log("Seeding demo data for store:", storeId);

    // Insert demo categories
    const categoriesWithStoreId = DEMO_CATEGORIES.map(cat => ({
      ...cat,
      store_id: storeId
    }));

    const { error: categoriesError } = await supabase
      .from("categories")
      .insert(categoriesWithStoreId);

    if (categoriesError) {
      console.error("Error inserting demo categories:", categoriesError);
      // Continue even if categories fail
    }

    // Insert demo products with generated slugs
    const productsWithStoreId = DEMO_PRODUCTS.map(product => ({
      ...product,
      store_id: storeId,
      slug: generateSlug(product.name) // Add slug to satisfy database constraint
    }));

    const { error: productsError } = await supabase
      .from("products")
      .insert(productsWithStoreId);

    if (productsError) {
      console.error("Error inserting demo products:", productsError);
      return false;
    }

    console.log("Demo data seeded successfully");
    return true;
  } catch (error) {
    console.error("Error seeding demo data:", error);
    return false;
  }
};

// Function to check if a store has products
export const storeHasProducts = async (storeId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("store_id", storeId)
      .limit(1);

    if (error) {
      console.error("Error checking store products:", error);
      return false;
    }

    return (data && data.length > 0);
  } catch (error) {
    console.error("Error checking store products:", error);
    return false;
  }
};
