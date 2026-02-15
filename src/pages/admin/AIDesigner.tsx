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
  CheckCircle2,
  AlertCircle,
  Eye,
  MessageSquare,
  Calendar,
  RefreshCw,
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

// ------- Main AIDesigner Page -------
const AIDesigner = () => {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("My Store");
  const [storeUrl, setStoreUrl] = useState<string | null>(null);
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
        .select("id, name, slug, subdomain")
        .eq("user_id", session.user.id)
        .single();

      if (!store) {
        toast.error("Store not found");
        return;
      }

      setStoreId(store.id);
      setStoreName(store.name || "My Store");

      // Build store preview URL (same-origin so we can inject CSS into iframe)
      const hostname = window.location.hostname;
      const isSubdomain = store.subdomain && hostname.startsWith(store.subdomain + '.');
      const url = isSubdomain
        ? `${window.location.origin}/`
        : `${window.location.origin}/${store.slug}`;
      setStoreUrl(url);

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
      injectCSSIntoIframe(result.design);
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
      injectCSSIntoIframe(null);
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

  // Inject AI design CSS into the live store iframe
  const injectCSSIntoIframe = (design: AIDesignResult | null) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.head) return;
    let styleEl = iframe.contentDocument.getElementById('ai-preview-styles') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = iframe.contentDocument.createElement('style');
      styleEl.id = 'ai-preview-styles';
      iframe.contentDocument.head.appendChild(styleEl);
    }
    styleEl.textContent = design ? buildDesignCSS(design) : '';
  };

  // Re-inject CSS when iframe finishes loading (handles page navigations inside iframe)
  const handleIframeLoad = () => {
    injectCSSIntoIframe(previewDesign);
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {previewDesign ? "Live preview with AI design" : "Live store preview"}
          </span>
          {previewDesign && (
            <Badge variant="outline" className="text-primary border-primary text-xs">
              AI Applied
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => iframeRef.current?.contentWindow?.location.reload()}
          title="Reload preview"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex-1 rounded-lg overflow-hidden border border-border" style={{ minHeight: "600px" }}>
        {storeUrl ? (
          <iframe
            ref={iframeRef}
            src={storeUrl}
            className="w-full h-full"
            style={{ minHeight: "600px" }}
            onLoad={handleIframeLoad}
            title="Store Preview"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading preview...
          </div>
        )}
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
