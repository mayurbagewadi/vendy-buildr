import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, Eye, EyeOff, ExternalLink, Loader2, Save, Settings as SettingsIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { PaymentGatewayCredentials } from "@/lib/payment/types";

type PaymentMode = "online_only" | "online_and_cod";

type PaymentFormData = {
  razorpay_enabled: boolean;
  razorpay_key_id: string;
  razorpay_key_secret: string;
  phonepe_enabled: boolean;
  phonepe_merchant_id: string;
  phonepe_salt_key: string;
  phonepe_salt_index: string;
  cashfree_enabled: boolean;
  cashfree_app_id: string;
  cashfree_secret_key: string;
  payu_enabled: boolean;
  payu_merchant_key: string;
  payu_merchant_salt: string;
  paytm_enabled: boolean;
  paytm_merchant_id: string;
  paytm_merchant_key: string;
  stripe_enabled: boolean;
  stripe_publishable_key: string;
  stripe_secret_key: string;
  payment_mode: PaymentMode;
};

const defaultFormData: PaymentFormData = {
  razorpay_enabled: false,
  razorpay_key_id: "",
  razorpay_key_secret: "",
  phonepe_enabled: false,
  phonepe_merchant_id: "",
  phonepe_salt_key: "",
  phonepe_salt_index: "",
  cashfree_enabled: false,
  cashfree_app_id: "",
  cashfree_secret_key: "",
  payu_enabled: false,
  payu_merchant_key: "",
  payu_merchant_salt: "",
  paytm_enabled: false,
  paytm_merchant_id: "",
  paytm_merchant_key: "",
  stripe_enabled: false,
  stripe_publishable_key: "",
  stripe_secret_key: "",
  payment_mode: "online_and_cod",
};

const PaymentSettings = () => {
  const [formData, setFormData] = useState<PaymentFormData>(defaultFormData);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openGatewayDialog, setOpenGatewayDialog] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState({
    razorpay_key_secret: false,
  });

  const hasAnyGatewayEnabled =
    formData.razorpay_enabled ||
    formData.phonepe_enabled ||
    formData.cashfree_enabled ||
    formData.payu_enabled ||
    formData.paytm_enabled ||
    formData.stripe_enabled;

  useEffect(() => {
    const loadPaymentSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: store, error } = await supabase
          .from("stores")
          .select("id, payment_gateway_credentials, payment_mode")
          .eq("user_id", user.id)
          .single();

        if (error) throw error;
        if (!store) return;

        const pgCreds = (store.payment_gateway_credentials as PaymentGatewayCredentials | null) || {};
        setStoreId(store.id);
        setFormData({
          razorpay_enabled: pgCreds?.razorpay?.enabled || false,
          razorpay_key_id: pgCreds?.razorpay?.key_id || "",
          razorpay_key_secret: pgCreds?.razorpay?.key_secret || "",
          phonepe_enabled: pgCreds?.phonepe?.enabled || false,
          phonepe_merchant_id: pgCreds?.phonepe?.merchant_id || "",
          phonepe_salt_key: pgCreds?.phonepe?.salt_key || "",
          phonepe_salt_index: pgCreds?.phonepe?.salt_index || "",
          cashfree_enabled: pgCreds?.cashfree?.enabled || false,
          cashfree_app_id: pgCreds?.cashfree?.app_id || "",
          cashfree_secret_key: pgCreds?.cashfree?.secret_key || "",
          payu_enabled: pgCreds?.payu?.enabled || false,
          payu_merchant_key: pgCreds?.payu?.merchant_key || "",
          payu_merchant_salt: pgCreds?.payu?.merchant_salt || "",
          paytm_enabled: pgCreds?.paytm?.enabled || false,
          paytm_merchant_id: pgCreds?.paytm?.merchant_id || "",
          paytm_merchant_key: pgCreds?.paytm?.merchant_key || "",
          stripe_enabled: pgCreds?.stripe?.enabled || false,
          stripe_publishable_key: pgCreds?.stripe?.publishable_key || "",
          stripe_secret_key: pgCreds?.stripe?.secret_key || "",
          payment_mode: (store.payment_mode as PaymentMode) || "online_and_cod",
        });
      } catch (error) {
        console.error("Error loading payment settings:", error);
        toast({
          variant: "destructive",
          title: "Load Failed",
          description: "Could not load payment settings. Please refresh and try again.",
        });
      } finally {
        setIsFetching(false);
      }
    };

    loadPaymentSettings();
  }, []);

  const handleInputChange = (field: keyof PaymentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!storeId) return;

    if (formData.razorpay_enabled && (!formData.razorpay_key_id.trim() || !formData.razorpay_key_secret.trim())) {
      toast({
        variant: "destructive",
        title: "Razorpay Credentials Required",
        description: "Add both Key ID and Key Secret before enabling Razorpay.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        payment_gateway_credentials: {
          razorpay: {
            enabled: formData.razorpay_enabled,
            key_id: formData.razorpay_key_id || null,
            key_secret: formData.razorpay_key_secret || null,
          },
          phonepe: {
            enabled: formData.phonepe_enabled,
            merchant_id: formData.phonepe_merchant_id || null,
            salt_key: formData.phonepe_salt_key || null,
            salt_index: formData.phonepe_salt_index || null,
          },
          cashfree: {
            enabled: formData.cashfree_enabled,
            app_id: formData.cashfree_app_id || null,
            secret_key: formData.cashfree_secret_key || null,
          },
          payu: {
            enabled: formData.payu_enabled,
            merchant_key: formData.payu_merchant_key || null,
            merchant_salt: formData.payu_merchant_salt || null,
          },
          paytm: {
            enabled: formData.paytm_enabled,
            merchant_id: formData.paytm_merchant_id || null,
            merchant_key: formData.paytm_merchant_key || null,
          },
          stripe: {
            enabled: formData.stripe_enabled,
            publishable_key: formData.stripe_publishable_key || null,
            secret_key: formData.stripe_secret_key || null,
          },
        },
        payment_mode: formData.payment_mode,
      };

      const { error } = await supabase
        .from("stores")
        .update(updateData)
        .eq("id", storeId);

      if (error) throw error;

      toast({
        title: "Payment Settings Saved",
        description: "Your checkout payment settings have been updated.",
      });
    } catch (error) {
      console.error("Error saving payment settings:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not save payment settings. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderGatewayStatus = (enabled: boolean, configured: boolean) => {
    if (enabled && configured) {
      return (
        <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-1 rounded-full font-medium">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          Active
        </span>
      );
    }

    return (
      <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
        Not configured
      </span>
    );
  };

  if (isFetching) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="h-8 w-56 bg-muted animate-pulse rounded-lg" />
        <div className="h-40 w-full bg-muted animate-pulse rounded-xl" />
        <div className="h-64 w-full bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <CreditCard className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Payments</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure payment gateways and checkout payment options.
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving || !storeId} size="lg" className="px-8">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Alert>
        <CreditCard className="h-4 w-4" />
        <AlertDescription>
          Payments go directly to the store owner's gateway account. Use test credentials first, then switch to live credentials after a successful test order.
        </AlertDescription>
      </Alert>

      {hasAnyGatewayEnabled ? (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-1">Payment Methods at Checkout</h2>
              <p className="text-sm text-muted-foreground">
                Choose which payment options customers will see during checkout.
              </p>
            </div>

            <div className="inline-flex rounded-lg border-2 border-primary/20 p-1 bg-background">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, payment_mode: "online_only" }))}
                className={`px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  formData.payment_mode === "online_only"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Online Payment Only
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, payment_mode: "online_and_cod" }))}
                className={`px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  formData.payment_mode === "online_and_cod"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Online + COD
              </button>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
              <div className="mt-0.5">
                {formData.payment_mode === "online_only" ? (
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formData.payment_mode === "online_only" ? (
                  <>
                    <strong>Online Payment Only:</strong> Customers can only pay using configured payment gateways. Cash on Delivery will not be available.
                  </>
                ) : (
                  <>
                    <strong>Online + COD:</strong> Customers can choose online payment or Cash on Delivery.
                  </>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert className="bg-amber-500/10 border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900 dark:text-amber-100">
            <strong>Cash on Delivery Only:</strong> Configure Razorpay below to enable online payments.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payment Gateway Configuration</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure active payment providers for this store.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setOpenGatewayDialog("razorpay")}
            className="relative text-left group cursor-pointer border-2 rounded-xl p-6 transition-all hover:shadow-lg hover:border-blue-500/50 hover:-translate-y-1"
            style={{ borderColor: formData.razorpay_enabled ? "#3b82f6" : "transparent" }}
          >
            <div className="absolute top-4 right-4">
              {renderGatewayStatus(formData.razorpay_enabled, Boolean(formData.razorpay_key_id))}
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">Razorpay</h3>
                <p className="text-sm text-muted-foreground mb-3">Cards, UPI, net banking and wallets</p>
                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                  <SettingsIcon className="w-3.5 h-3.5" />
                  Click to configure
                </div>
              </div>
            </div>
          </button>

          {[
            { name: "PhonePe", detail: "UPI & Digital", active: formData.phonepe_enabled, configured: Boolean(formData.phonepe_merchant_id), bgClass: "bg-purple-500/10", iconClass: "text-purple-600" },
            { name: "Cashfree", detail: "Payments & Payouts", active: formData.cashfree_enabled, configured: Boolean(formData.cashfree_app_id), bgClass: "bg-green-500/10", iconClass: "text-green-600" },
            { name: "PayU", detail: "Leading Solution", active: formData.payu_enabled, configured: Boolean(formData.payu_merchant_key), bgClass: "bg-orange-500/10", iconClass: "text-orange-600" },
            { name: "Paytm", detail: "Wallet & Gateway", active: formData.paytm_enabled, configured: Boolean(formData.paytm_merchant_id), bgClass: "bg-sky-500/10", iconClass: "text-sky-600" },
            { name: "Stripe", detail: "Global Platform", active: formData.stripe_enabled, configured: Boolean(formData.stripe_publishable_key), bgClass: "bg-indigo-500/10", iconClass: "text-indigo-600" },
          ].map((gateway) => (
            <div
              key={gateway.name}
              className="relative border-2 rounded-xl p-6 opacity-60 cursor-not-allowed select-none"
              style={{ borderColor: "transparent" }}
            >
              <div className="absolute top-4 right-4">
                {gateway.active && gateway.configured ? (
                  renderGatewayStatus(true, true)
                ) : (
                  <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full font-medium">
                    Coming Soon
                  </span>
                )}
              </div>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${gateway.bgClass}`}>
                  <CreditCard className={`w-6 h-6 ${gateway.iconClass}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1">{gateway.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{gateway.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Alert className="bg-amber-500/5 border-amber-500/20">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-600 dark:text-amber-400">
          <strong>Important:</strong> API secrets should be treated like passwords. Only store owners should have access to this page.
        </AlertDescription>
      </Alert>

      <Dialog open={openGatewayDialog === "razorpay"} onOpenChange={(open) => !open && setOpenGatewayDialog(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              Configure Razorpay
            </DialogTitle>
            <DialogDescription>
              Enter your Razorpay API credentials to enable online payments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <Label className="text-base font-medium">Enable Razorpay</Label>
              <Switch
                checked={formData.razorpay_enabled}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({ ...prev, razorpay_enabled: checked }))
                }
              />
            </div>

            <div>
              <Label htmlFor="razorpay_key_id">Key ID</Label>
              <Input
                id="razorpay_key_id"
                type="text"
                placeholder="Enter your Razorpay Key ID"
                value={formData.razorpay_key_id}
                onChange={(e) => handleInputChange("razorpay_key_id", e.target.value)}
                className="admin-input mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Get this from Razorpay Dashboard - Settings - API Keys.
              </p>
            </div>

            <div>
              <Label htmlFor="razorpay_key_secret">Key Secret</Label>
              <div className="relative mt-2">
                <Input
                  id="razorpay_key_secret"
                  type={showSecrets.razorpay_key_secret ? "text" : "password"}
                  placeholder="Enter your Razorpay Key Secret"
                  value={formData.razorpay_key_secret}
                  onChange={(e) => handleInputChange("razorpay_key_secret", e.target.value)}
                  className="admin-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecrets(prev => ({
                    ...prev,
                    razorpay_key_secret: !prev.razorpay_key_secret,
                  }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecrets.razorpay_key_secret ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Keep this secret safe. Never share it publicly.
              </p>
            </div>

            <Alert className="bg-blue-500/5 border-blue-500/20">
              <ExternalLink className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Sign up:</strong>{" "}
                <a href="https://razorpay.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">
                  razorpay.com
                </a>{" "}
                <strong className="ml-2">Docs:</strong>{" "}
                <a href="https://razorpay.com/docs" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">
                  razorpay.com/docs
                </a>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenGatewayDialog(null)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => setOpenGatewayDialog(null)}
              className="admin-button-primary"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentSettings;
