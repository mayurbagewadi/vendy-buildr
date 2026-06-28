import { useNavigate } from "react-router-dom";
import { ArrowLeft, Info, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import Header from "@/new-storefront/components/StorefrontHeader";
import StoreFooter from "@/components/customer/StoreFooter";
import { useStorefront } from "@/contexts/StoreContext";
import { isStoreSpecificDomain } from "@/lib/domainUtils";
import { getStorefrontPageVariant } from "@/new-storefront/theme-engine/resolveTheme";

const About = () => {
  const { store, profile, storeSlug, loading } = useStorefront();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) return null;

  const backLink = isStoreSpecificDomain() ? "/" : `/${storeSlug}`;
  const isEditorialContent = getStorefrontPageVariant(store.storefront_template, "content") === "editorial-content";

  return (
    <div className={isEditorialContent ? "flex min-h-screen flex-col bg-[#fbfaf6] text-stone-900" : "flex min-h-screen flex-col"}>
      <Header />

      <main className={isEditorialContent ? "mx-auto mt-16 w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8" : "container mx-auto mt-16 flex-1 px-4 py-8"}>
        <Button variant="ghost" onClick={() => navigate(backLink)} className={isEditorialContent ? "mb-6 rounded-full text-stone-600 hover:text-emerald-700" : "mb-6"}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Store
        </Button>

        <div className="mx-auto max-w-4xl space-y-8">
          <div className={isEditorialContent ? "rounded-2xl border border-stone-100 bg-gradient-to-br from-white to-emerald-50/40 p-6 shadow-sm" : ""}>
            {isEditorialContent && <p className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-700">EcoSoap Story</p>}
            <h1 className={isEditorialContent ? "font-serif text-4xl font-semibold text-stone-950" : "mb-2 text-4xl font-bold text-foreground"}>
              About {store.name}
            </h1>
            <p className={isEditorialContent ? "mt-3 text-sm leading-relaxed text-stone-500" : "text-muted-foreground"}>Learn more about this store and its story</p>
          </div>

          <section className={isEditorialContent ? "rounded-2xl border border-stone-100 bg-white p-6 shadow-sm" : "rounded-lg border border-border bg-card p-6"}>
            {store.description ? (
              <div className={isEditorialContent ? "prose prose-sm max-w-none whitespace-pre-wrap leading-7 text-stone-600" : "prose prose-sm max-w-none whitespace-pre-wrap text-muted-foreground leading-relaxed"}>
                {store.description}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Info className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium text-muted-foreground">
                  This store hasn't added an About Us description yet.
                </p>
                <p className="text-sm text-muted-foreground/60">
                  Check back later for more information about {store.name}.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      <StoreFooter
        storeName={store.name}
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

export default About;
