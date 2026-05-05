import { useNavigate } from "react-router-dom";
import { ArrowLeft, Info } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/customer/Header";
import StoreFooter from "@/components/customer/StoreFooter";
import { isStoreSpecificDomain } from "@/lib/domainUtils";
import { useStorefront } from "@/contexts/StoreContext";

const About = () => {
  const { store, profile, storeSlug, loading } = useStorefront();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) return null;

  const backLink = isStoreSpecificDomain() ? "/" : `/${storeSlug}`;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 mt-16">
        <Button
          variant="ghost"
          onClick={() => navigate(backLink)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Store
        </Button>

        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              About {store.name}
            </h1>
            <p className="text-muted-foreground">
              Learn more about this store and its story
            </p>
          </div>

          <section className="bg-card border border-border rounded-lg p-6">
            {store.description ? (
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {store.description}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Info className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-muted-foreground font-medium">
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
        socialLinks={store.social_links as any}
        policies={store.policies as any}
      />
    </div>
  );
};

export default About;
