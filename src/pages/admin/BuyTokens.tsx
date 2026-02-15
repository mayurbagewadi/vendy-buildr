import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Coins, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TokenPackage {
  id: string;
  name: string;
  description: string | null;
  tokens_included: number;
  price: number;
  is_active: boolean;
  display_order: number;
}

interface StoreData {
  id: string;
  user_id: string;
}

const BuyTokens = () => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);

      const [storeResult, profileResult, packagesResult] = await Promise.all([
        supabase.from("stores").select("id, user_id").eq("user_id", session.user.id).single(),
        supabase.from("profiles").select("full_name, email, phone").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("ai_token_packages").select("*").eq("is_active", true).order("display_order"),
      ]);

      if (storeResult.data) setStoreData(storeResult.data);
      if (profileResult.data) {
        setCustomerDetails({
          name: profileResult.data.full_name || session.user.email || "",
          email: profileResult.data.email || session.user.email || "",
          phone: profileResult.data.phone || "",
        });
      }
      if (packagesResult.data) setPackages(packagesResult.data);
    } catch (error) {
      toast.error("Failed to load token packages");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: TokenPackage) => {
    if (!storeData || !userId) return;

    setPurchasing(pkg.id);
    try {
      // Call ai-designer edge function to create Razorpay order using platform credentials
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        "ai-designer",
        {
          body: {
            action: "create_payment_order",
            store_id: storeData.id,
            package_id: pkg.id,
            amount: pkg.price,
            currency: "INR",
          },
        }
      );

      if (orderError || !orderData?.success || !orderData?.order_id) {
        throw new Error(orderData?.error || "Failed to create payment order");
      }

      // Load Razorpay and open checkout
      const razorpay = new (window as any).Razorpay({
        key: orderData.razorpay_key_id,
        amount: orderData.amount,
        currency: "INR",
        name: "AI Designer Tokens",
        description: `${pkg.name} — ${pkg.tokens_included} tokens`,
        order_id: orderData.order_id,
        prefill: {
          name: customerDetails.name,
          email: customerDetails.email,
          contact: customerDetails.phone,
        },
        theme: { color: "#3b82f6" },
        handler: async (response: any) => {
          await handlePaymentSuccess(response, pkg);
        },
        modal: {
          ondismiss: () => {
            setPurchasing(null);
          },
        },
      });
      razorpay.open();
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate payment");
      setPurchasing(null);
    }
  };

  const handlePaymentSuccess = async (response: any, pkg: TokenPackage) => {
    if (!storeData || !userId) return;
    try {
      // Get token expiry settings
      const { data: tokenSettings } = await supabase
        .from("ai_token_settings")
        .select("token_expiry_enabled, token_expiry_duration, token_expiry_unit")
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .single();

      let expiresAt: string | null = null;
      if (tokenSettings?.token_expiry_enabled) {
        const expiry = new Date();
        if (tokenSettings.token_expiry_unit === "years") {
          expiry.setFullYear(expiry.getFullYear() + (tokenSettings.token_expiry_duration || 1));
        } else {
          expiry.setMonth(expiry.getMonth() + (tokenSettings.token_expiry_duration || 12));
        }
        expiresAt = expiry.toISOString();
      }

      // Record the purchase
      const { error } = await supabase.from("ai_token_purchases").insert({
        store_id: storeData.id,
        user_id: userId,
        package_id: pkg.id,
        tokens_purchased: pkg.tokens_included,
        tokens_remaining: pkg.tokens_included,
        tokens_used: 0,
        amount_paid: pkg.price,
        payment_id: response.razorpay_payment_id,
        expires_at: expiresAt,
        status: "active",
      });

      if (error) throw error;

      toast.success(`${pkg.tokens_included} tokens added to your account!`);
      navigate("/admin/ai-designer");
    } catch (error: any) {
      toast.error("Payment recorded but failed to add tokens. Please contact support.");
      console.error(error);
    } finally {
      setPurchasing(null);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);

  const getPricePerToken = (pkg: TokenPackage) =>
    (pkg.price / pkg.tokens_included).toFixed(2);

  const isPopular = (pkg: TokenPackage) => pkg.name.toLowerCase() === "pro";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/ai-designer")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to AI Designer
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Coins className="w-6 h-6 text-primary" />
          Buy AI Designer Tokens
        </h1>
        <p className="text-muted-foreground">
          Purchase tokens to use the AI Designer. Each design generation uses 1 token.
        </p>
      </div>

      {/* What are tokens? */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">How tokens work</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  Each AI design generation uses 1 token
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  Tokens expire based on platform settings (typically 12 months)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  Publish applies the design to your live store instantly
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  Reset to default is always free — no tokens needed
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token Packages */}
      {packages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Coins className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No packages available</h3>
            <p className="text-muted-foreground text-sm">Check back later for token packages.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              className={`relative flex flex-col transition-all duration-200 hover:shadow-lg ${
                isPopular(pkg) ? "border-primary shadow-md" : ""
              }`}
            >
              {isPopular(pkg) && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="px-3">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-xl ${isPopular(pkg) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <Coins className="w-5 h-5" />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    ₹{getPricePerToken(pkg)}/token
                  </Badge>
                </div>
                <CardTitle className="text-xl mt-3">{pkg.name}</CardTitle>
                {pkg.description && (
                  <CardDescription>{pkg.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-4">
                <div>
                  <span className="text-3xl font-bold text-foreground">{formatPrice(pkg.price)}</span>
                  <p className="text-muted-foreground text-sm mt-1">
                    {pkg.tokens_included.toLocaleString("en-IN")} design generations
                  </p>
                </div>

                <ul className="space-y-2 flex-1">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    {pkg.tokens_included} AI design generations
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    Publish to live store instantly
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    Reset to default anytime (free)
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    Full CSS & layout control
                  </li>
                </ul>

                <Button
                  className="w-full mt-auto"
                  variant={isPopular(pkg) ? "default" : "outline"}
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing === pkg.id}
                >
                  {purchasing === pkg.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4 mr-2" />
                      Buy {pkg.name}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BuyTokens;
