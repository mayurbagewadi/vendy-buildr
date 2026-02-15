import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Coins,
  Upload,
  RotateCcw,
  Loader2,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Eye,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getTokenBalance,
  generateDesign,
  applyDesign,
  resetDesign,
  getAppliedDesign,
  buildDesignCSS,
  type AIDesignResult,
  type TokenBalance,
} from "@/lib/aiDesigner";

// ------- Store Preview Mockup -------
const StorePreviewMockup = ({
  design,
  storeName,
}: {
  design: AIDesignResult | null;
  storeName: string;
}) => {
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!previewRef.current) return;
    if (!design || !design.css_variables) {
      // Clear injected vars
      const el = previewRef.current;
      Object.keys({
        "--primary": "",
        "--background": "",
        "--foreground": "",
        "--card": "",
        "--muted": "",
        "--muted-foreground": "",
        "--border": "",
        "--radius": "",
      }).forEach((k) => el.style.removeProperty(k));
      return;
    }
    const el = previewRef.current;
    Object.entries(design.css_variables).forEach(([k, v]) => {
      el.style.setProperty(k, v);
    });
  }, [design]);

  const cols =
    design?.layout?.product_grid_cols === "3"
      ? "grid-cols-3"
      : design?.layout?.product_grid_cols === "2"
      ? "grid-cols-2"
      : "grid-cols-4";

  const padding =
    design?.layout?.section_padding === "compact"
      ? "py-4"
      : design?.layout?.section_padding === "spacious"
      ? "py-10"
      : "py-6";

  return (
    <div
      ref={previewRef}
      className="bg-background text-foreground rounded-lg overflow-hidden border border-border text-xs font-sans h-full overflow-y-auto"
      style={{ fontSize: "10px" }}
    >
      {/* Mockup Header */}
      <div className="bg-card border-b border-border px-3 py-2 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
            <ShoppingBag className="w-2.5 h-2.5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground truncate max-w-[80px]">{storeName}</span>
        </div>
        <div className="flex gap-2 text-muted-foreground">
          <span className="hover:text-primary cursor-pointer">Home</span>
          <span className="hover:text-primary cursor-pointer">Products</span>
          <span className="hover:text-primary cursor-pointer">Categories</span>
        </div>
      </div>

      {/* Hero Banner */}
      <div
        className={`${padding} bg-gradient-to-r from-primary/20 via-primary/10 to-background flex flex-col items-center text-center`}
      >
        <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary mb-2 flex items-center justify-center">
          <ShoppingBag className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-lg font-bold text-foreground mb-1">{storeName}</h1>
        <p className="text-muted-foreground text-[9px]">Your favourite online store</p>
        <div className="flex gap-2 mt-2">
          <span className="px-2 py-1 bg-primary text-primary-foreground rounded-[var(--radius)] text-[9px] font-medium">
            Browse Products
          </span>
          <span className="px-2 py-1 border border-primary text-primary rounded-[var(--radius)] text-[9px] font-medium">
            Contact Us
          </span>
        </div>
      </div>

      {/* Categories */}
      <div className={`${padding} bg-muted/30 px-3`}>
        <p className="font-semibold text-foreground mb-2 text-center">Shop by Category</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {["Fashion", "Electronics", "Home", "Beauty"].map((cat) => (
            <div
              key={cat}
              className="flex-shrink-0 bg-card border border-border rounded-[var(--radius)] px-2 py-1 text-center"
            >
              <div className="w-8 h-8 rounded-[var(--radius)] bg-primary/10 mx-auto mb-1 flex items-center justify-center">
                <ShoppingBag className="w-3 h-3 text-primary" />
              </div>
              <span className="text-muted-foreground text-[8px]">{cat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Products */}
      <div className={`${padding} bg-background px-3`}>
        <div className="flex justify-between items-center mb-2">
          <p className="font-semibold text-foreground">Featured Products</p>
          <span className="text-primary text-[9px] cursor-pointer">See All →</span>
        </div>
        <div className={`grid ${cols} gap-2`}>
          {["Product 1", "Product 2", "Product 3", "Product 4"].map((p) => (
            <div
              key={p}
              className="bg-card border border-border rounded-[var(--radius)] overflow-hidden"
            >
              <div className="aspect-square bg-muted flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="p-1.5">
                <p className="text-muted-foreground text-[8px]">Category</p>
                <p className="font-medium text-foreground text-[9px] leading-tight">{p}</p>
                <p className="text-primary font-bold text-[9px] mt-0.5">₹999</p>
                <div className="mt-1 border border-border rounded-[var(--radius)] text-center text-[8px] py-0.5 text-muted-foreground">
                  View Details
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Banner */}
      <div className={`${padding} bg-primary text-primary-foreground px-3 text-center`}>
        <p className="font-bold text-[11px] mb-1">Ready to Start Shopping?</p>
        <p className="text-[8px] opacity-80 mb-2">Explore our full collection</p>
        <span className="px-3 py-1 bg-primary-foreground text-primary rounded-[var(--radius)] text-[9px] font-medium">
          Browse All Products
        </span>
      </div>

      {/* Footer */}
      <div className="bg-muted border-t border-border px-3 py-3">
        <p className="font-semibold text-foreground text-[9px] mb-1">{storeName}</p>
        <p className="text-muted-foreground text-[8px]">Your favourite online store</p>
        <div className="flex gap-2 mt-1">
          {["Facebook", "Instagram", "Twitter"].map((s) => (
            <span key={s} className="text-primary text-[8px] cursor-pointer">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ------- Main AIDesigner Page -------
const AIDesigner = () => {
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("My Store");
  const [tokenBalance, setTokenBalance] = useState<TokenBalance>({
    tokens_remaining: 0,
    expires_at: null,
    has_tokens: false,
  });
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [currentDesign, setCurrentDesign] = useState<AIDesignResult | null>(null);
  const [pendingDesign, setPendingDesign] = useState<AIDesignResult | null>(null);
  const [pendingHistoryId, setPendingHistoryId] = useState<string | undefined>();
  const [previewDesign, setPreviewDesign] = useState<AIDesignResult | null>(null);
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);

      const { data: store } = await supabase
        .from("stores")
        .select("id, name")
        .eq("user_id", session.user.id)
        .single();

      if (!store) {
        toast.error("Store not found");
        return;
      }

      setStoreId(store.id);
      setStoreName(store.name || "My Store");

      const [balance, appliedDesign] = await Promise.all([
        getTokenBalance(store.id),
        getAppliedDesign(store.id),
      ]);

      setTokenBalance(balance);
      if (appliedDesign) {
        setCurrentDesign(appliedDesign);
        setPreviewDesign(appliedDesign);
      }
    } catch (error: any) {
      toast.error("Failed to load AI Designer");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!storeId || !userId) return;
    if (!prompt.trim()) {
      toast.error("Please enter a design prompt");
      return;
    }
    if (!tokenBalance.has_tokens) {
      toast.error("No tokens remaining. Please buy tokens first.");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateDesign(storeId, userId, prompt.trim());
      setPendingDesign(result.design);
      setPendingHistoryId(result.history_id);
      setPreviewDesign(result.design);
      setTokenBalance((prev) => ({
        ...prev,
        tokens_remaining: result.tokens_remaining,
        has_tokens: result.tokens_remaining > 0,
      }));
      toast.success(`Design generated! ${result.tokens_remaining} tokens remaining.`);
    } catch (error: any) {
      if (error.message?.includes("No tokens")) {
        toast.error("No tokens remaining. Please buy tokens.");
      } else {
        toast.error(error.message || "Failed to generate design");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!storeId || !pendingDesign) {
      toast.error("No design to publish. Generate a design first.");
      return;
    }
    setIsPublishing(true);
    try {
      await applyDesign(storeId, pendingDesign, pendingHistoryId);
      setCurrentDesign(pendingDesign);
      setPendingDesign(null);
      setPendingHistoryId(undefined);
      toast.success("Design published to your live store!");
    } catch (error: any) {
      toast.error(error.message || "Failed to publish design");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReset = async () => {
    if (!storeId) return;
    setIsResetting(true);
    try {
      await resetDesign(storeId);
      setCurrentDesign(null);
      setPendingDesign(null);
      setPendingHistoryId(undefined);
      setPreviewDesign(null);
      toast.success("Store reset to platform default design.");
    } catch (error: any) {
      toast.error(error.message || "Failed to reset design");
    } finally {
      setIsResetting(false);
    }
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    return new Date(expiresAt).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ------- Chat Panel -------
  const ChatPanel = (
    <div className="flex flex-col gap-4 h-full">
      {/* Prompt Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Describe your design
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={
              tokenBalance.has_tokens
                ? 'e.g. "Make it modern with green colors and rounded corners" or "Give it a dark minimal look with large product cards"'
                : "Purchase tokens to start generating designs"
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={!tokenBalance.has_tokens || isGenerating}
            rows={4}
            className="resize-none"
          />
          <Button
            onClick={handleGenerate}
            disabled={!tokenBalance.has_tokens || isGenerating || !prompt.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating design...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Design
              </>
            )}
          </Button>
          {!tokenBalance.has_tokens && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">
                No tokens remaining.{" "}
                <button
                  onClick={() => navigate("/admin/buy-tokens")}
                  className="underline font-medium"
                >
                  Buy tokens
                </button>{" "}
                to continue.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Response */}
      {pendingDesign && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-foreground mb-2">
                  {pendingDesign.summary}
                </p>
                <ul className="space-y-1">
                  {pendingDesign.changes_list?.map((change, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {pendingDesign.css_variables && Object.keys(pendingDesign.css_variables).length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Color Changes</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(pendingDesign.css_variables)
                    .filter(([k]) => k !== "--radius")
                    .map(([key, value]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div
                          className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                          style={{ background: `hsl(${value})` }}
                        />
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {key.replace("--", "")}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground italic">
              Preview updated on the right. Click Publish to apply to your live store.
            </p>
          </CardContent>
        </Card>
      )}

      {currentDesign && !pendingDesign && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="text-sm text-foreground font-medium">AI design is currently live</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              Generate a new design or reset to default.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ------- Preview Panel -------
  const PreviewPanel = (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          {previewDesign ? "Preview with AI design" : "Preview — platform default"}
        </span>
        {previewDesign && (
          <Badge variant="outline" className="text-primary border-primary text-xs">
            AI Applied
          </Badge>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <StorePreviewMockup design={previewDesign} storeName={storeName} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          AI Designer
        </h1>
        <p className="text-muted-foreground">
          Use AI to redesign your store's look and feel
        </p>
      </div>

      {/* Token Balance Card */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Coins className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    {tokenBalance.tokens_remaining}
                  </span>
                  <span className="text-muted-foreground text-sm">tokens remaining</span>
                  {tokenBalance.has_tokens ? (
                    <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      No Tokens
                    </Badge>
                  )}
                </div>
                {tokenBalance.expires_at && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Expires {formatExpiry(tokenBalance.expires_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin/buy-tokens")}
              >
                <Coins className="w-4 h-4 mr-1.5" />
                Buy Tokens
              </Button>
              <Button
                size="sm"
                onClick={handlePublish}
                disabled={!pendingDesign || isPublishing}
              >
                {isPublishing ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-1.5" />
                )}
                Publish Changes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isResetting || (!currentDesign && !pendingDesign)}
              >
                {isResetting ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                )}
                Reset to Default
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile View Toggle */}
      <div className="flex md:hidden gap-2">
        <Button
          variant={mobileView === "chat" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setMobileView("chat")}
        >
          <MessageSquare className="w-4 h-4 mr-1.5" />
          AI Chat
        </Button>
        <Button
          variant={mobileView === "preview" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setMobileView("preview")}
        >
          <Eye className="w-4 h-4 mr-1.5" />
          Preview
        </Button>
      </div>

      {/* Desktop: Split view | Mobile: Toggle */}
      <div className="hidden md:grid md:grid-cols-2 gap-4" style={{ minHeight: "600px" }}>
        <div className="overflow-y-auto">{ChatPanel}</div>
        <div>{PreviewPanel}</div>
      </div>

      {/* Mobile: Single view */}
      <div className="md:hidden" style={{ minHeight: "500px" }}>
        {mobileView === "chat" ? ChatPanel : PreviewPanel}
      </div>
    </div>
  );
};

export default AIDesigner;
