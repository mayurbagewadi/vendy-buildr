import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

import Header from "@/new-storefront/components/StorefrontHeader";
import StoreFooter from "@/components/customer/StoreFooter";
import { Button } from "@/components/ui/button";
import { useStorefront } from "@/contexts/StoreContext";
import { isStoreSpecificDomain } from "@/lib/domainUtils";
import { getStorefrontPageVariant } from "@/new-storefront/theme-engine/resolveTheme";

interface PoliciesProps {
  slug?: string;
}

const Policies = ({ slug: slugProp }: PoliciesProps = {}) => {
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug = slugProp || slugParam;
  const navigate = useNavigate();
  const { store, profile, storeSlug, loading } = useStorefront();

  useEffect(() => {
    if (window.location.hash) {
      const element = document.querySelector(window.location.hash);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) return null;

  const policies = store.policies || {};
  const isEditorialContent = getStorefrontPageVariant(store.storefront_template, "content") === "editorial-content";
  const policyCardClass = isEditorialContent
    ? "rounded-2xl border border-stone-100 bg-white p-6 shadow-sm"
    : "rounded-lg border border-border bg-card p-6";
  const policyHeadingClass = isEditorialContent
    ? "mb-4 font-serif text-2xl font-semibold text-stone-950"
    : "mb-4 text-2xl font-bold text-foreground";
  const policyBodyClass = isEditorialContent
    ? "prose prose-sm max-w-none whitespace-pre-wrap leading-7 text-stone-600"
    : "prose prose-sm max-w-none whitespace-pre-wrap text-muted-foreground";

  return (
    <div className={isEditorialContent ? "flex min-h-screen flex-col bg-[#fbfaf6] text-stone-900" : "flex min-h-screen flex-col"}>
      <Header storeSlug={slug} />

      <main className={isEditorialContent ? "mx-auto mt-16 w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8" : "container mx-auto mt-16 flex-1 px-4 py-8"}>
        <Button
          variant="ghost"
          onClick={() => navigate(isStoreSpecificDomain() ? "/" : `/${storeSlug || slug}`)}
          className={isEditorialContent ? "mb-6 rounded-full text-stone-600 hover:text-emerald-700" : "mb-6"}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Store
        </Button>

        <div className="mx-auto max-w-4xl space-y-12">
          <div className={isEditorialContent ? "rounded-2xl border border-stone-100 bg-gradient-to-br from-white to-emerald-50/40 p-6 shadow-sm" : ""}>
            {isEditorialContent && <p className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-700">EcoSoap Care Notes</p>}
            <h1 className={isEditorialContent ? "font-serif text-4xl font-semibold text-stone-950" : "mb-2 text-4xl font-bold text-foreground"}>Store Policies</h1>
            <p className={isEditorialContent ? "mt-3 text-sm leading-relaxed text-stone-500" : "text-muted-foreground"}>Learn about our policies and terms of service</p>
          </div>

          <section id="terms" className="scroll-mt-20">
            <div className={policyCardClass}>
              <h2 className={policyHeadingClass}>Terms & Conditions</h2>
              <div className={policyBodyClass}>
                {policies.termsConditions || "Terms and conditions will be available soon."}
              </div>
            </div>
          </section>

          <section id="return-policy" className="scroll-mt-20">
            <div className={policyCardClass}>
              <h2 className={policyHeadingClass}>Return Policy</h2>
              <div className={policyBodyClass}>
                {policies.returnPolicy || "Return policy will be available soon."}
              </div>
            </div>
          </section>

          <section id="shipping-policy" className="scroll-mt-20">
            <div className={policyCardClass}>
              <h2 className={policyHeadingClass}>Shipping Policy</h2>
              <div className={policyBodyClass}>
                {policies.shippingPolicy || "Shipping policy will be available soon."}
              </div>
            </div>
          </section>

          <section id="privacy-policy" className="scroll-mt-20">
            <div className={policyCardClass}>
              <h2 className={policyHeadingClass}>Privacy Policy</h2>
              <div className={policyBodyClass}>
              {policies.privacyPolicy || "Privacy policy will be available soon."}
              </div>
            </div>
          </section>

          {policies.deliveryAreas && (
            <section id="delivery-areas" className="scroll-mt-20">
              <div className={policyCardClass}>
                <h2 className={policyHeadingClass}>Delivery Areas</h2>
                <div className={policyBodyClass}>
                  {policies.deliveryAreas}
                </div>
              </div>
            </section>
          )}

          {store.address && (
            <section id="address" className="scroll-mt-20">
              <div className={policyCardClass}>
                <h2 className={policyHeadingClass}>Store Address</h2>
                <div className={isEditorialContent ? "prose prose-sm max-w-none text-stone-600" : "prose prose-sm max-w-none text-muted-foreground"}>{store.address}</div>
              </div>
            </section>
          )}
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

export default Policies;
