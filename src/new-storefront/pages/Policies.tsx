import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import Header from "@/new-storefront/components/StorefrontHeader";
import StoreFooter from "@/components/customer/StoreFooter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { isStoreSpecificDomain } from "@/lib/domainUtils";
import { ECOSOAP_THEME, getThemeByTemplate } from "@/lib/themeRegistry";

interface StoreData {
  id: string;
  name: string;
  description: string | null;
  whatsapp_number: string | null;
  logo_url: string | null;
  hero_banner_url: string | null;
  policies: {
    returnPolicy?: string | null;
    shippingPolicy?: string | null;
    termsConditions?: string | null;
    deliveryAreas?: string | null;
    privacyPolicy?: string | null;
  } | null;
  address: string | null;
  social_links: {
    facebook?: string | null;
    instagram?: string | null;
    twitter?: string | null;
  } | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  twitter_url?: string | null;
  youtube_url?: string | null;
  linkedin_url?: string | null;
  storefront_template?: string | null;
}

interface ProfileData {
  phone: string | null;
  email: string | null;
}

interface PoliciesProps {
  slug?: string;
}

const Policies = ({ slug: slugProp }: PoliciesProps = {}) => {
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug = slugProp || slugParam;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  useEffect(() => {
    loadStoreData();
  }, [slug]);

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

  const loadStoreData = async () => {
    try {
      setLoading(true);
      const normalizedSlug = (slug ?? "").toLowerCase();
      let storeQuery = supabase.from("stores").select("*").eq("is_active", true);
      if (normalizedSlug.includes(".")) {
        storeQuery = storeQuery.or(`custom_domain.eq.${normalizedSlug},subdomain.eq.${normalizedSlug}`);
      } else {
        storeQuery = storeQuery.or(`subdomain.eq.${normalizedSlug},slug.eq.${normalizedSlug}`);
      }

      const { data: storeResults, error: storeError } = await storeQuery.limit(1);
      const store = storeResults?.[0] ?? null;

      if (storeError || !store) {
        toast.error("Store not found");
        navigate("/");
        return;
      }

      setStoreData(store as StoreData);

      const { data: profile } = await supabase
        .from("profiles")
        .select("phone, email")
        .eq("user_id", store.user_id)
        .single();

      if (profile) {
        setProfileData(profile);
      }
    } catch (error) {
      console.error("Error loading store:", error);
      toast.error("Failed to load store information");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!storeData) return null;

  const policies = storeData.policies || {};
  const activeMarketplaceTheme = getThemeByTemplate(storeData.storefront_template);
  const isEcoSoapTheme = activeMarketplaceTheme?.id === ECOSOAP_THEME.id;
  const policyCardClass = isEcoSoapTheme
    ? "rounded-2xl border border-stone-100 bg-white p-6 shadow-sm"
    : "rounded-lg border border-border bg-card p-6";
  const policyHeadingClass = isEcoSoapTheme
    ? "mb-4 font-serif text-2xl font-semibold text-stone-950"
    : "mb-4 text-2xl font-bold text-foreground";
  const policyBodyClass = isEcoSoapTheme
    ? "prose prose-sm max-w-none whitespace-pre-wrap leading-7 text-stone-600"
    : "prose prose-sm max-w-none whitespace-pre-wrap text-muted-foreground";

  return (
    <div className={isEcoSoapTheme ? "flex min-h-screen flex-col bg-[#fbfaf6] text-stone-900" : "flex min-h-screen flex-col"}>
      <Header storeSlug={slug} />

      <main className={isEcoSoapTheme ? "mx-auto mt-16 w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8" : "container mx-auto mt-16 flex-1 px-4 py-8"}>
        <Button
          variant="ghost"
          onClick={() => navigate(isStoreSpecificDomain() ? "/" : `/${slug}`)}
          className={isEcoSoapTheme ? "mb-6 rounded-full text-stone-600 hover:text-emerald-700" : "mb-6"}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Store
        </Button>

        <div className="mx-auto max-w-4xl space-y-12">
          <div className={isEcoSoapTheme ? "rounded-2xl border border-stone-100 bg-gradient-to-br from-white to-emerald-50/40 p-6 shadow-sm" : ""}>
            {isEcoSoapTheme && <p className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-700">EcoSoap Care Notes</p>}
            <h1 className={isEcoSoapTheme ? "font-serif text-4xl font-semibold text-stone-950" : "mb-2 text-4xl font-bold text-foreground"}>Store Policies</h1>
            <p className={isEcoSoapTheme ? "mt-3 text-sm leading-relaxed text-stone-500" : "text-muted-foreground"}>Learn about our policies and terms of service</p>
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

          {storeData.address && (
            <section id="address" className="scroll-mt-20">
              <div className={policyCardClass}>
                <h2 className={policyHeadingClass}>Store Address</h2>
                <div className={isEcoSoapTheme ? "prose prose-sm max-w-none text-stone-600" : "prose prose-sm max-w-none text-muted-foreground"}>{storeData.address}</div>
              </div>
            </section>
          )}
        </div>
      </main>

      <StoreFooter
        storeName={storeData.name}
        storeDescription={storeData.description}
        whatsappNumber={storeData.whatsapp_number}
        phone={profileData?.phone}
        email={profileData?.email}
        address={storeData.address}
        facebookUrl={storeData.facebook_url}
        instagramUrl={storeData.instagram_url}
        twitterUrl={storeData.twitter_url}
        youtubeUrl={storeData.youtube_url}
        linkedinUrl={storeData.linkedin_url}
        socialLinks={storeData.social_links}
        policies={storeData.policies}
      />
    </div>
  );
};

export default Policies;
