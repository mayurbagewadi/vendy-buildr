import { Link } from "react-router-dom";
import { ArrowRight, Leaf, Sparkles } from "lucide-react";

import StoreFooter from "@/components/customer/StoreFooter";
import { SEOHead } from "@/components/seo/SEOHead";
import StorefrontImage from "@/components/ui/storefront-image";
import { isStoreSpecificDomain } from "@/lib/domainUtils";
import { getStoreCanonicalUrl } from "@/lib/seo/canonicalUrl";
import type { ThemeCategoriesProps } from "@/new-storefront/theme-engine/types";

const fallbackImages = [
  "/themes/ecosoap/lavender_oatmeal_soap.png",
  "/themes/ecosoap/citrus_calendula_soap.png",
  "/themes/ecosoap/activated_charcoal_soap.png",
];

const EcoSoapCategories = ({ store, profile, storeSlug, categories }: ThemeCategoriesProps) => {
  const storeName = store.name || "Store";
  const baseProductsPath = isStoreSpecificDomain()
    ? "/products"
    : storeSlug
      ? `/${storeSlug}/products`
      : "/products";
  const categoryLink = (name: string) => `${baseProductsPath}?category=${encodeURIComponent(name)}`;
  const canonical = `${getStoreCanonicalUrl(store.slug || storeSlug || "", store.subdomain, store.custom_domain)}/categories`;

  return (
    <div className="flex min-h-screen flex-col bg-[#fbfaf6] text-stone-900">
      <SEOHead
        title={`Collections - ${storeName} | Botanical Product Categories`}
        description={`Explore curated collections at ${storeName}. Browse product categories in a premium EcoSoap Boutique storefront experience.`}
        canonical={canonical}
        keywords={categories.map((category) => category.name).concat([storeName, "collections", "categories", "shop"])}
        type="website"
      />

      <main className="flex-1">
        <section className="border-b border-stone-100 bg-gradient-to-b from-[#fbfaf6] via-white to-[#f5f1e8] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-emerald-800">
                <Leaf className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-widest">EcoSoap Collections</span>
              </div>
              <h1 data-ai="categories-hero-heading" className="font-serif text-4xl font-semibold leading-tight text-stone-950 md:text-5xl">
                Shop by botanical ritual
              </h1>
              <p data-ai="categories-hero-subtitle" className="mt-4 max-w-2xl text-sm leading-relaxed text-stone-500 sm:text-base">
                Move quickly from scent families and skincare needs to the right handmade soaps, blends, and care essentials.
              </p>
              <div className="mt-7 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ["Curated", "Collections"],
                  ["Fast", "Discovery"],
                  ["Secure", "Checkout"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-stone-100 bg-white/80 p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">{label}</p>
                    <p className="mt-1 font-serif text-lg font-semibold text-stone-950">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative pb-8">
              <div className="overflow-hidden rounded-2xl border-4 border-white bg-stone-100 shadow-2xl">
                <img
                  src="/themes/ecosoap/hero_soap_banner.png"
                  alt={`${storeName} botanical soap collections`}
                  className="aspect-[4/3] w-full object-cover"
                  loading="eager"
                />
              </div>
              <div className="absolute bottom-0 left-5 right-5 rounded-2xl border border-emerald-100 bg-white/95 p-4 shadow-xl backdrop-blur">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-800">
                  <Sparkles className="h-4 w-4" />
                  Premium storefront experience
                </p>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  Same catalog data and URLs, upgraded presentation for collection browsing.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section data-ai="categories-page" className="bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Browse collections</p>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-stone-950">Choose your care path</h2>
              </div>
              <p className="text-sm text-stone-500">{categories.length} collections available</p>
            </div>

            <div data-ai="categories-grid" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.map((category, index) => {
                const imageUrl = category.image_url || fallbackImages[index % fallbackImages.length];
                const productCount = category.productCount ?? 0;

                return (
                  <Link
                    key={category.id}
                    to={categoryLink(category.name)}
                    data-ai="category-card"
                    className="group block overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-100 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                  >
                    <div data-ai="category-card-image-container" className="relative aspect-[4/3] overflow-hidden bg-stone-50">
                      <StorefrontImage
                        src={imageUrl}
                        alt={`${category.name} collection`}
                        purpose="category-card"
                        data-ai="category-card-image"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        priority={index < 4}
                      />
                      <div data-ai="category-card-overlay" className="absolute inset-0 bg-gradient-to-t from-stone-950/72 via-stone-950/12 to-transparent" />
                      <span className="absolute left-4 top-4 rounded-full border border-white/25 bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-800 shadow">
                        Collection
                      </span>
                    </div>
                    <div className="p-5">
                      <h3 data-ai="category-card-name" className="font-serif text-xl font-semibold text-stone-950 transition-colors group-hover:text-emerald-800">
                        {category.name}
                      </h3>
                      <p data-ai="category-card-count" className="mt-1 text-sm text-stone-500">
                        {productCount} {productCount === 1 ? "product" : "products"}
                      </p>
                      <div className="mt-5 flex items-center justify-between border-t border-stone-50 pt-4">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">Explore</span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 text-white transition-colors group-hover:bg-emerald-700">
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <StoreFooter
        storeName={storeName}
        storeDescription={store.description}
        whatsappNumber={store.whatsapp_number}
        phone={profile?.phone}
        email={profile?.email}
        address={store.address}
        facebookUrl={store.facebook_url}
        instagramUrl={store.instagram_url}
        twitterUrl={store.twitter_url}
        youtubeUrl={store.youtube_url}
        linkedinUrl={store.linkedin_url}
        socialLinks={store.social_links}
        policies={store.policies}
      />
    </div>
  );
};

export default EcoSoapCategories;
