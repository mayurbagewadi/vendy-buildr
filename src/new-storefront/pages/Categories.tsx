import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import CategoryCard from "@/components/customer/CategoryCard";
import Header from "@/components/customer/Header";
import { LoadingSpinner } from "@/components/customer/LoadingSpinner";
import StoreFooter from "@/components/customer/StoreFooter";
import { SEOHead } from "@/components/seo/SEOHead";
import { useStorefront } from "@/contexts/StoreContext";
import { supabase } from "@/integrations/supabase/client";
import { getStoreCanonicalUrl } from "@/lib/seo/canonicalUrl";

interface Category {
  id: string;
  name: string;
  image_url?: string | null;
  display_order?: number;
  store_id?: string;
  productCount?: number;
}

interface CategoryProductCount {
  category: string;
  product_count: number;
}

const DEMO_CATEGORIES: Category[] = [
  {
    id: "demo-1",
    name: "Electronics",
    image_url: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400",
    store_id: "demo",
  },
  {
    id: "demo-2",
    name: "Fashion",
    image_url: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=400",
    store_id: "demo",
  },
  {
    id: "demo-3",
    name: "Home & Living",
    image_url: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400",
    store_id: "demo",
  },
  {
    id: "demo-4",
    name: "Beauty",
    image_url: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400",
    store_id: "demo",
  },
  {
    id: "demo-5",
    name: "Sports",
    image_url: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400",
    store_id: "demo",
  },
  {
    id: "demo-6",
    name: "Books",
    image_url: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400",
    store_id: "demo",
  },
];

interface CategoriesProps {
  slug?: string;
}

const Categories = ({ slug: slugProp }: CategoriesProps = {}) => {
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug = slugProp || slugParam;
  const { store, profile, loading: storeLoading } = useStorefront();
  const storeAny = store as any;

  const loadCategoryCounts = async (storeIdToUse: string): Promise<Map<string, number>> => {
    const { data: rpcCounts, error: rpcError } = await (supabase as any)
      .rpc("get_category_product_counts", { p_store_id: storeIdToUse });

    if (!rpcError && rpcCounts) {
      return new Map(
        (rpcCounts as CategoryProductCount[]).map((row) => [
          row.category,
          Number(row.product_count) || 0,
        ])
      );
    }

    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("category")
      .eq("store_id", storeIdToUse)
      .eq("status", "published")
      .not("category", "is", null);

    if (productsError) throw productsError;

    const counts = new Map<string, number>();
    for (const product of productsData || []) {
      const category = product.category;
      if (!category) continue;
      counts.set(category, (counts.get(category) || 0) + 1);
    }
    return counts;
  };

  const {
    data: categories = DEMO_CATEGORIES,
    isLoading: categoriesLoading,
  } = useQuery({
    queryKey: ["store-categories", store?.id],
    queryFn: async () => {
      try {
        const storeIdToUse = store!.id;
        const [categoriesResult, productCounts] = await Promise.all([
          supabase
            .from("categories")
            .select("*")
            .eq("store_id", storeIdToUse)
            .order("created_at", { ascending: true }),
          loadCategoryCounts(storeIdToUse),
        ]);

        if (categoriesResult.error) throw categoriesResult.error;

        const categoriesWithCounts: Category[] = (categoriesResult.data || []).map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          image_url: cat.image_url,
          store_id: cat.store_id,
          productCount: productCounts.get(cat.name) || 0,
        }));

        return categoriesWithCounts.length > 0 ? categoriesWithCounts : DEMO_CATEGORIES;
      } catch (err) {
        console.error("Error loading categories:", err);
        return DEMO_CATEGORIES;
      }
    },
    enabled: !!store?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const loading = storeLoading || categoriesLoading;
  const storeName = storeAny?.name || "Store";

  if (loading) {
    return (
      <>
        <Header storeSlug={slug} storeId={store?.id} />
        <div className="flex min-h-screen items-center justify-center">
          <LoadingSpinner size="lg" text="Loading categories..." />
        </div>
        <StoreFooter storeName={storeName} />
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SEOHead
        title={`Categories - ${storeName} | Browse Our Collections`}
        description={`Explore all product categories at ${storeName}. Find exactly what you're looking for in our organized collections.`}
        canonical={`${getStoreCanonicalUrl(storeAny?.slug || slug || "", storeAny?.subdomain, storeAny?.custom_domain)}/categories`}
        keywords={categories.map((c) => c.name).concat([storeName, "categories", "shop by category"])}
        type="website"
      />
      <Header storeSlug={slug} storeId={store?.id} />

      <main className="flex-1">
        <section data-ai="categories-page" className="bg-gradient-to-b from-muted/30 to-background py-16">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center">
              <h1 data-ai="categories-hero-heading" className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
                Shop by Category
              </h1>
              <p data-ai="categories-hero-subtitle" className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Explore our curated collections designed just for you
              </p>
            </div>

            <div data-ai="categories-grid" className="mx-auto grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.map((category, index) => (
                <CategoryCard
                  key={category.id}
                  name={category.name}
                  image_url={category.image_url}
                  productCount={category.productCount}
                  slug={slug}
                  priorityImage={index < 4}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      <StoreFooter
        storeName={storeName}
        storeDescription={storeAny?.description}
        whatsappNumber={storeAny?.whatsapp_number}
        phone={profile?.phone}
        email={profile?.email}
        address={storeAny?.address}
        facebookUrl={storeAny?.facebook_url}
        instagramUrl={storeAny?.instagram_url}
        twitterUrl={storeAny?.twitter_url}
        youtubeUrl={storeAny?.youtube_url}
        linkedinUrl={storeAny?.linkedin_url}
        socialLinks={storeAny?.social_links}
        policies={storeAny?.policies}
      />
    </div>
  );
};

export default Categories;
