import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/customer/Header";
import StoreFooter from "@/components/customer/StoreFooter";

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
  } | null;
  address: string | null;
  social_links: {
    facebook?: string | null;
    instagram?: string | null;
    twitter?: string | null;
  } | null;
}

interface ProfileData {
  phone: string | null;
  email: string | null;
}

const Policies = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  useEffect(() => {
    loadStoreData();
  }, [slug]);

  useEffect(() => {
    // Scroll to section if hash is present
    if (window.location.hash) {
      const element = document.querySelector(window.location.hash);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [loading]);

  const loadStoreData = async () => {
    try {
      setLoading(true);
      
      const { data: store, error: storeError } = await supabase
        .from("stores")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!storeData) {
    return null;
  }

  const policies = storeData.policies || {};

  return (
    <div className="min-h-screen flex flex-col">
      <Header storeSlug={slug} />

      <main className="flex-1 container mx-auto px-4 py-8 mt-16">
        <Button
          variant="ghost"
          onClick={() => navigate(`/${slug}`)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Store
        </Button>

        <div className="max-w-4xl mx-auto space-y-12">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Store Policies</h1>
            <p className="text-muted-foreground">
              Learn about our policies and terms of service
            </p>
          </div>

          {/* Terms & Conditions */}
          <section id="terms" className="scroll-mt-20">
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Terms & Conditions
              </h2>
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                {policies.termsConditions || "Terms and conditions will be available soon."}
              </div>
            </div>
          </section>

          {/* Return Policy */}
          <section id="return-policy" className="scroll-mt-20">
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Return Policy
              </h2>
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                {policies.returnPolicy || "Return policy will be available soon."}
              </div>
            </div>
          </section>

          {/* Shipping Policy */}
          <section id="shipping-policy" className="scroll-mt-20">
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Shipping Policy
              </h2>
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                {policies.shippingPolicy || "Shipping policy will be available soon."}
              </div>
            </div>
          </section>

          {/* Delivery Areas */}
          {policies.deliveryAreas && (
            <section id="delivery-areas" className="scroll-mt-20">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Delivery Areas
                </h2>
                <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                  {policies.deliveryAreas}
                </div>
              </div>
            </section>
          )}

          {/* Address */}
          {storeData.address && (
            <section id="address" className="scroll-mt-20">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Store Address
                </h2>
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  {storeData.address}
                </div>
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
        socialLinks={storeData.social_links}
        policies={storeData.policies}
      />
    </div>
  );
};

export default Policies;
