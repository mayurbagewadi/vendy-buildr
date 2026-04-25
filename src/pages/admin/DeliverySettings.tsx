import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Save, Plus, Trash2, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DeliveryTier {
  min: number | null;
  max: number | null;
  fee: number | null;
}

const DeliverySettings = () => {
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [mode, setMode] = useState<'single' | 'multiple'>('single');
  const [singleFee, setSingleFee] = useState("");
  const [singleFreeAbove, setSingleFreeAbove] = useState("");
  const [tiers, setTiers] = useState<DeliveryTier[]>([{ min: null, max: null, fee: null }]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: store } = await supabase
          .from("stores")
          .select("id, delivery_mode, delivery_fee_amount, free_delivery_above, delivery_tiers")
          .eq("user_id", user.id)
          .single();

        if (store) {
          setStoreId(store.id);
          const savedMode = (store.delivery_mode as 'single' | 'multiple') || 'single';
          setMode(savedMode);
          if (savedMode === 'single') {
            setSingleFee(store.delivery_fee_amount != null ? String(store.delivery_fee_amount) : "");
            setSingleFreeAbove(store.free_delivery_above != null ? String(store.free_delivery_above) : "");
          } else {
            const savedTiers = store.delivery_tiers as DeliveryTier[] | null;
            if (savedTiers && savedTiers.length > 0) setTiers(savedTiers);
          }
        }
      } catch (error) {
        console.error("Error loading delivery settings:", error);
      } finally {
        setIsFetching(false);
      }
    };
    load();
  }, []);

  const handleModeSwitch = (newMode: 'single' | 'multiple') => {
    if (newMode === mode) return;
    setMode(newMode);
    setSingleFee("");
    setSingleFreeAbove("");
    setTiers([{ min: 0, max: null, fee: 0 }]);
  };

  const addTier = () => {
    setTiers(prev => [...prev, { min: null, max: null, fee: null }]);
  };

  const removeTier = (index: number) => {
    if (tiers.length === 1) return;
    setTiers(prev => prev.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof DeliveryTier, value: string) => {
    setTiers(prev =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const parsed = value === "" ? null : parseFloat(value);
        return { ...t, [field]: parsed };
      })
    );
  };

  const validateSingle = (): string | null => {
    if (singleFee !== "" && singleFreeAbove === "")
      return "Please set the free delivery threshold.";
    if (singleFee !== "" && parseFloat(singleFee) < 0)
      return "Delivery fee cannot be negative.";
    if (singleFreeAbove !== "" && parseFloat(singleFreeAbove) <= 0)
      return "Free delivery threshold must be greater than 0.";
    return null;
  };

  const validateMultiple = (): string | null => {
    if (tiers.length === 0) return "Add at least one delivery tier.";
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      if (t.fee < 0) return `Tier ${i + 1}: fee cannot be negative.`;
      if (i < tiers.length - 1 && (t.max === null || t.max <= t.min))
        return `Tier ${i + 1}: max order value must be greater than min.`;
    }
    return null;
  };

  const handleSave = async () => {
    if (!storeId) return;
    const validationError = mode === 'single' ? validateSingle() : validateMultiple();
    if (validationError) {
      toast({ variant: "destructive", title: "Validation Error", description: validationError });
      return;
    }
    setIsLoading(true);
    try {
      const updateData: any = { delivery_mode: mode };
      if (mode === 'single') {
        updateData.delivery_fee_amount = singleFee !== "" ? parseFloat(singleFee) : null;
        updateData.free_delivery_above = singleFreeAbove !== "" ? parseFloat(singleFreeAbove) : null;
        updateData.delivery_tiers = null;
      } else {
        updateData.delivery_tiers = tiers;
        updateData.delivery_fee_amount = null;
        updateData.free_delivery_above = null;
      }
      const { error } = await supabase.from("stores").update(updateData).eq("id", storeId);
      if (error) throw error;
      toast({ title: "Saved", description: "Delivery charges updated successfully." });
    } catch (error) {
      toast({ variant: "destructive", title: "Save Failed", description: "Could not save delivery settings. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  // Derived status label for header badge
  const getStatusLabel = () => {
    if (mode === 'single') {
      if (!singleFee) return { text: "Free Delivery", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
      return { text: `₹${singleFee} Fee Active`, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
    }
    return { text: `${tiers.length} Tier${tiers.length > 1 ? 's' : ''} Configured`, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" };
  };

  if (isFetching) {
    return (
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="h-32 w-full bg-muted animate-pulse rounded-xl" />
        <div className="h-48 w-full bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  const status = getStatusLabel();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Truck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Delivery Charges</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Control how delivery fees are charged at checkout</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${status.color}`}>
          {status.text}
        </span>
      </div>

      {/* Mode Toggle */}
      <div className="space-y-2">
        <Label className="text-sm font-medium block">Delivery Fee Type</Label>
        <div className="inline-flex rounded-lg border-2 border-primary/20 p-1 bg-background">
          <button
            type="button"
            onClick={() => handleModeSwitch('single')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === 'single'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            Single Rule
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('multiple')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === 'multiple'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            Multiple Rules
          </button>
        </div>
      </div>

      {/* Single Mode */}
      {mode === 'single' && (
        <Card className="border-2">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="single_fee" className="text-sm font-medium">Delivery Fee</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">₹</span>
                  <Input
                    id="single_fee"
                    type="number"
                    min="0"
                    placeholder="50"
                    value={singleFee}
                    onChange={(e) => setSingleFee(e.target.value)}
                    className="pl-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Leave blank for always free delivery.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="single_free_above" className="text-sm font-medium">Free Delivery Above</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">₹</span>
                  <Input
                    id="single_free_above"
                    type="number"
                    min="0"
                    placeholder="500"
                    value={singleFreeAbove}
                    onChange={(e) => setSingleFreeAbove(e.target.value)}
                    className="pl-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Orders at or above this get free delivery.</p>
              </div>
            </div>

            {/* Live Preview */}
            <div className="rounded-xl bg-muted/50 border p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer Preview</p>
              {singleFee === "" ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span>All orders → <strong className="text-green-600 dark:text-green-400">Free Delivery</strong></span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                    <span>Orders below ₹{singleFreeAbove || "—"} → <strong>₹{singleFee} delivery fee</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Orders ₹{singleFreeAbove || "—"} & above → <strong className="text-green-600 dark:text-green-400">Free Delivery</strong></span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Multiple Mode */}
      {mode === 'multiple' && (
        <Card className="border-2">
          <CardContent className="p-6 space-y-4">

            {/* Info banner */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                The last tier has no upper limit. Set fee to <strong>0</strong> for free delivery on that range.
              </p>
            </div>

            {/* Tier Rows */}
            <div className="space-y-3">
              {tiers.map((tier, index) => {
                return (
                  <div
                    key={index}
                    className="p-4 rounded-xl border bg-card hover:border-primary/30 transition-colors space-y-3"
                  >
                    {/* Tier header row */}
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTier(index)}
                        disabled={tiers.length === 1}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Fields — stack on mobile, row on sm+ */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Min */}
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Min Order (₹)</p>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                          <Input
                            type="number"
                            min="0"
                            value={tier.min ?? ""}
                            placeholder="e.g. 0"
                            onChange={(e) => updateTier(index, 'min', e.target.value)}
                            onFocus={(e) => { if (parseFloat(e.target.value) === 0) updateTier(index, 'min', ''); }}
                            onBlur={(e) => { if (e.target.value === '') updateTier(index, 'min', '0'); }}
                            className="pl-6 h-9 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>

                      {/* Max */}
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Max Order (₹)</p>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                          <Input
                            type="number"
                            min="0"
                            value={tier.max ?? ""}
                            onChange={(e) => updateTier(index, 'max', e.target.value)}
                            placeholder="No limit"
                            className="pl-6 h-9 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Leave blank for no upper limit.</p>
                      </div>

                      {/* Fee */}
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Delivery Fee (₹)</p>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                          <Input
                            type="number"
                            min="0"
                            value={tier.fee ?? ""}
                            onChange={(e) => updateTier(index, 'fee', e.target.value)}
                            onFocus={(e) => { if (parseFloat(e.target.value) === 0) updateTier(index, 'fee', ''); }}
                            onBlur={(e) => { if (e.target.value === '') updateTier(index, 'fee', '0'); }}
                            placeholder="0 = Free"
                            className="pl-6 h-9 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                        {(tier.fee === 0 || tier.fee === null) && (
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium">Free delivery</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Tier */}
            <button
              type="button"
              onClick={addTier}
              className="w-full py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/30 transition-all duration-200 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-4 h-4" />
              Add Tier
            </button>

          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isLoading} size="lg" className="px-8">
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>

    </div>
  );
};

export default DeliverySettings;
