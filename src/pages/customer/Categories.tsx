import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/customer/Header";
import Footer from "@/components/customer/Footer";
import CategoryCard from "@/components/customer/CategoryCard";
import { LoadingSpinner } from "@/components/customer/LoadingSpinner";
import { SEOHead } from "@/components/seo/SEOHead";
import { getStoreCanonicalUrl } from "@/lib/seo/canonicalUrl";

interface Category {
  id: string;
  name: string;
  image_url?: string | null;
  display_order?: number;
  store_id?: string;
  productCount?: number;
}

// Demo categories with images (fallback)
const DEMO_CATEGORIES: Category[] = [
  {
    id: "demo-1",
    name: "Electronics",
    image_url: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400",
    store_id: "demo"
  },
  {
    id: "demo-2",
    name: "Fashion",
    image_url: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=400",
    store_id: "demo"
  },
  {
    id: "demo-3",
    name: "Home & Living",
    image_url: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400",
    store_id: "demo"
  },
  {
    id: "demo-4",
    name: "Beauty",
    image_url: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400",
    store_id: "demo"
  },
  {
    id: "demo-5",
    name: "Sports",
    image_url: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400",
    store_id: "demo"
  },
  {
    id: "demo-6",
    name: "Books",
    image_url: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400",
    store_id: "demo"
  }
];

interface CategoriesProps {
  slug?: string;
}

const Categories = ({ slug: slugProp }: CategoriesProps = {}) => {
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug = slugProp || slugParam;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>("Store");

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoading(true);

        let storeIdToUse: string | null = null;

        // Fetch store data if accessing via /:slug/categories
        if (slug) {
          const { data: storeData } = await supabase
            .from("stores")
            .select("id, name")
            .eq("slug", slug)
            .eq("is_active", true)
            .maybeSingle();

          if (storeData) {
            storeIdToUse = storeData.id;
            setStoreId(storeData.id);
            setStoreName(storeData.name);
          } else {
            // Store not found, use demo categories
            setCategories(DEMO_CATEGORIES);
            setLoading(false);
            return;
          }
        } else {
          // If no slug, fetch the current user's store
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: storeData } = await supabase
              .from("stores")
              .select("id, name")
              .eq("user_id", user.id)
              .eq("is_active", true)
              .maybeSingle();

            if (storeData) {
              storeIdToUse = storeData.id;
              setStoreId(storeData.id);
              setStoreName(storeData.name);
            }
          }
        }

        if (storeIdToUse) {
          try {
            // Fetch categories
            const { data: categoriesData, error: categoriesError } = await supabase
              .from("categories")
              .select("*")
              .eq("store_id", storeIdToUse)
              .order("created_at", { ascending: true });

            if (categoriesError) throw categoriesError;

            // Fetch product counts for each category
            const categoriesWithCounts: Category[] = await Promise.all(
              (categoriesData || []).map(async (cat: any) => {
                const { count, error } = await supabase
                  .from("products")
                  .select("*", { count: "exact", head: true })
                  .eq("store_id", storeIdToUse)
                  .eq("category", cat.name)
                  .eq("status", "published");

                console.log(`Category "${cat.name}": ${count} products`, { error });

                return {
                  id: cat.id,
                  name: cat.name,
                  image_url: cat.image_url,
                  store_id: cat.store_id,
                  productCount: count || 0
                };
              })
            );

            console.log("Categories with counts:", categoriesWithCounts);

            setCategories(categoriesWithCounts.length > 0 ? categoriesWithCounts : DEMO_CATEGORIES);
          } catch (err) {
            console.error("Error fetching categories:", err);
            setCategories(DEMO_CATEGORIES);
          }
        } else {
          // No store found, use demo categories
          setCategories(DEMO_CATEGORIES);
        }
      } catch (err) {
        console.error("Error loading categories:", err);
        // On error, show demo categories instead of error
        setCategories(DEMO_CATEGORIES);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [slug]);

  if (loading) {
    return (
      <>
        <Header storeSlug={slug} storeId={storeId} />
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading categories..." />
        </div>
        <Footer />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title={`Categories - ${storeName} | Browse Our Collections`}
        description={`Explore all product categories at ${storeName}. Find exactly what you're looking for in our organized collections.`}
        canonical={getStoreCanonicalUrl(slug || '', null, null)}
        keywords={categories.map(c => c.name).concat([storeName, 'categories', 'shop by category'])}
        type="website"
      />
      <Header storeSlug={slug} storeId={storeId} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-muted/30 to-background py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                Shop by Category
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Explore our curated collections designed just for you
              </p>
            </div>

            {/* Categories Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {categories.map((category) => (
                <CategoryCard
                  key={category.id}
                  name={category.name}
                  image_url={category.image_url}
                  productCount={category.productCount}
                  slug={slug}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Categories;
