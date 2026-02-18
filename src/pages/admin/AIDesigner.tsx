import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Send,
  Bot,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  chatWithAI,
  applyDesign,
  resetDesign,
  getAppliedDesign,
  getTokenBalance,
  buildDesignCSS,
  type AIDesignResult,
  type TokenBalance,
  type ChatMessage as APIChatMessage,
} from "@/lib/aiDesigner";

// UI message type (shown in the chat UI)
interface UIMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  design?: AIDesignResult;
  historyId?: string;
  isLoading?: boolean;
  timestamp?: Date;
  isDestructive?: boolean;
  destructiveInfo?: { changePercent: number; changedFields: string[]; message: string };
}

// Helper functions for WhatsApp-style timestamps
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDateSeparator = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

const shouldShowDateSeparator = (currentMsg: UIMessage, previousMsg?: UIMessage): boolean => {
  if (!currentMsg.timestamp) return false;
  if (!previousMsg || !previousMsg.timestamp) return true;

  const currentDate = currentMsg.timestamp.toDateString();
  const previousDate = previousMsg.timestamp.toDateString();

  return currentDate !== previousDate;
};

// ------- Main AIDesigner Page -------
const AIDesigner = () => {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null); // ref to the scrollable container
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isInitialScrollRef = useRef(true); // true = first load, use instant scroll
  const previewDesignRef = useRef<AIDesignResult | null>(null); // always-current ref for iframe onLoad
  const cssRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // retry CSS injection after React hydration

  const [storeId, setStoreId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [storeUrl, setStoreUrl] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<TokenBalance>({
    tokens_remaining: 0,
    expires_at: null,
    has_tokens: false,
  });
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [pendingDesign, setPendingDesign] = useState<AIDesignResult | null>(null);
  const [pendingHistoryId, setPendingHistoryId] = useState<string | undefined>();
  const [previewDesign, setPreviewDesign] = useState<AIDesignResult | null>(null);
  const [currentDesign, setCurrentDesign] = useState<AIDesignResult | null>(null);
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
    return () => {
      if (cssRetryTimerRef.current) clearTimeout(cssRetryTimerRef.current);
    };
  }, []);

  // Auto-scroll chat to bottom
  // Uses direct scrollTop on the container (more reliable than scrollIntoView for fixed-height overflow containers)
  useEffect(() => {
    if (isLoading || messages.length === 0) return;
    const isInitial = isInitialScrollRef.current;
    const container = messagesContainerRef.current;
    if (!container) return;
    const timer = setTimeout(() => {
      container.scrollTop = container.scrollHeight;
      if (isInitial) isInitialScrollRef.current = false;
    }, 100);
    return () => clearTimeout(timer);
  }, [isLoading, messages]);

  // Load chat history from ai_designer_history table
  // Returns the most recent design found in history (for preview fallback)
  const loadChatHistory = async (storeId: string): Promise<AIDesignResult | null> => {
    try {
      // FIX #4: Include ai_css_overrides column for split storage support
      const { data: historyRecords, error } = await supabase
        .from("ai_designer_history")
        .select("id, prompt, ai_response, ai_css_overrides, applied, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true }); // oldest first

      if (error) {
        console.error("Failed to load chat history:", error);
        // Show welcome message if history fails to load
        setMessages([
          {
            id: "welcome",
            role: "ai",
            content: `Hi! I'm your AI Designer. I can help you redesign your store's colors, layout, and style.\n\nTry asking me:\n• "Give me design suggestions"\n• "Make it look modern and minimal"\n• "Change colors to green theme"\n• "What sections can you customize?"`,
          },
        ]);
        return null;
      }

      const loadedMessages: UIMessage[] = [];
      let lastDesign: AIDesignResult | null = null; // track most recent design for preview fallback

      // Add welcome message first
      loadedMessages.push({
        id: "welcome",
        role: "ai",
        content: `Hi! I'm your AI Designer. I can help you redesign your store's colors, layout, and style.\n\nTry asking me:\n• "Give me design suggestions"\n• "Make it look modern and minimal"\n• "Change colors to green theme"\n• "What sections can you customize?"`,
      });

      // Convert history records to chat messages
      if (historyRecords && historyRecords.length > 0) {
        historyRecords.forEach((record) => {
          const timestamp = new Date(record.created_at);

          // User message
          loadedMessages.push({
            id: `user-${record.id}`,
            role: "user",
            content: record.prompt,
            timestamp,
          });

          // AI response
          const aiResponse = typeof record.ai_response === 'string'
            ? JSON.parse(record.ai_response)
            : record.ai_response;

          if (aiResponse.type === "text") {
            // Casual text message — show as plain AI message, no design
            loadedMessages.push({
              id: `ai-${record.id}`,
              role: "ai",
              content: aiResponse.message || "",
              timestamp,
            });
          } else {
            // FIX #4: Merge ai_css_overrides back into design object for split storage
            if (record.ai_css_overrides) {
              aiResponse.css_overrides = record.ai_css_overrides;
            }

            loadedMessages.push({
              id: `ai-${record.id}`,
              role: "ai",
              content: aiResponse.summary || "Design generated",
              design: aiResponse,
              historyId: record.id,
              timestamp,
            });

            // Track last design for preview fallback (history is ASC so last = most recent)
            if (aiResponse.css_variables && Object.keys(aiResponse.css_variables).length > 0) {
              lastDesign = aiResponse;
            }
          }
        });
      }

      setMessages(loadedMessages);
      return lastDesign;
    } catch (error) {
      console.error("Error loading chat history:", error);
      // Show welcome message on error
      setMessages([
        {
          id: "welcome",
          role: "ai",
          content: `Hi! I'm your AI Designer. I can help you redesign your store's colors, layout, and style.\n\nTry asking me:\n• "Give me design suggestions"\n• "Make it look modern and minimal"\n• "Change colors to green theme"\n• "What sections can you customize?"`,
        },
      ]);
      return null;
    }
  };

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

      // Load chat history — also returns the most recent generated design for preview fallback
      const lastHistoryDesign = await loadChatHistory(store.id);

      // Set preview: published design takes priority, fall back to last generated design
      if (appliedDesign) {
        setCurrentDesign(appliedDesign);
        previewDesignRef.current = appliedDesign;
        setPreviewDesign(appliedDesign);
        // Clear reset flag — a published design exists, so reset is no longer the last action
        localStorage.removeItem(`ai_designer_reset_${store.id}`);
      } else if (lastHistoryDesign) {
        // No published design — only restore preview/pending if user did NOT explicitly reset
        const wasReset = localStorage.getItem(`ai_designer_reset_${store.id}`);
        if (!wasReset) {
          previewDesignRef.current = lastHistoryDesign;
          setPreviewDesign(lastHistoryDesign);
          setPendingDesign(lastHistoryDesign);
        }
        // If wasReset: leave preview empty → iframe shows platform default
      }
    } catch (error: any) {
      toast.error("Failed to load AI Designer");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Build API conversation history from UI messages (exclude welcome + loading)
  const buildAPIHistory = (uiMessages: UIMessage[]): APIChatMessage[] => {
    return uiMessages
      .filter((m) => m.id !== "welcome" && !m.isLoading)
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.role === "ai"
          ? (m.design ? `${m.content}\n\n[Design was generated]` : m.content)
          : m.content,
      }));
  };

  const handleSend = async () => {
    if (!storeId || !userId) return;
    const text = inputValue.trim();
    if (!text) return;

    const userMsgId = `user-${Date.now()}`;
    const loadingMsgId = `loading-${Date.now()}`;
    const now = new Date();

    const userMsg: UIMessage = {
      id: userMsgId,
      role: "user",
      content: text,
      timestamp: now,
    };
    const loadingMsg: UIMessage = {
      id: loadingMsgId,
      role: "ai",
      content: "",
      isLoading: true
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInputValue("");
    setIsSending(true);

    try {
      // Build conversation history including the new user message
      const history = buildAPIHistory([...messages, userMsg]);

      const result = await chatWithAI(storeId, userId, history);

      const aiMsg: UIMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        content: result.message,
        design: result.design,
        historyId: result.history_id,
        timestamp: new Date(),
        isDestructive: result.is_destructive || false,
        destructiveInfo: result.destructive_info || undefined,
      };

      // Replace loading message with actual response
      setMessages((prev) => prev.map((m) => m.id === loadingMsgId ? aiMsg : m));

      if (result.type === "design" && result.design) {
        setPendingDesign(result.design);
        setPendingHistoryId(result.history_id);
        previewDesignRef.current = result.design; // sync before any iframe reload
        setPreviewDesign(result.design);
        injectCSSIntoIframe(result.design);
        if (result.tokens_remaining !== undefined) {
          setTokenBalance((prev) => ({
            ...prev,
            tokens_remaining: result.tokens_remaining!,
            has_tokens: result.tokens_remaining! > 0,
          }));
        }
      }
    } catch (error: any) {
      setMessages((prev) => prev.filter((m) => m.id !== loadingMsgId));
      if (error.message?.includes("No tokens")) {
        toast.error("No tokens remaining. Please buy tokens.");
      } else if (
        error.message?.includes("Edge Function") ||
        error.message?.includes("non-2xx") ||
        error.message?.includes("status code") ||
        error.message?.includes("Failed to fetch")
      ) {
        toast.error("Unable to connect to AI. Please try again in a moment.");
      } else {
        toast.error(error.message || "Something went wrong. Please try again later.");
      }
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApplyFromMessage = (design: AIDesignResult, historyId?: string) => {
    setPendingDesign(design);
    setPendingHistoryId(historyId);
    previewDesignRef.current = design; // sync
    setPreviewDesign(design);
    injectCSSIntoIframe(design);
    toast.success("Design loaded into preview. Click Publish to go live.");
  };

  const handlePublish = async () => {
    if (!storeId || !pendingDesign) {
      toast.error("No design to publish. Ask AI to generate a design first.");
      return;
    }
    setIsPublishing(true);
    try {
      await applyDesign(storeId, pendingDesign, pendingHistoryId);
      setCurrentDesign(pendingDesign);
      setPendingDesign(null);
      setPendingHistoryId(undefined);
      // Clear reset flag — user has published a new design
      localStorage.removeItem(`ai_designer_reset_${storeId}`);
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
      previewDesignRef.current = null; // sync — handleIframeLoad will inject nothing
      setPreviewDesign(null);
      // Remember that user explicitly reset — prevents history design from being restored on refresh
      localStorage.setItem(`ai_designer_reset_${storeId}`, '1');
      // Force iframe reload so preview shows the actual platform default immediately
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.location.reload();
      } else {
        injectCSSIntoIframe(null); // fallback if reload not possible
      }
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

  const injectCSSIntoIframe = (design: AIDesignResult | null) => {
    try {
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument?.head) return;
      let styleEl = iframe.contentDocument.getElementById('ai-preview-styles') as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = iframe.contentDocument.createElement('style');
        styleEl.id = 'ai-preview-styles';
        iframe.contentDocument.head.appendChild(styleEl);
      }
      styleEl.textContent = design ? buildDesignCSS(design) : '';
    } catch {
      // Cross-origin or contentDocument not accessible — silently skip
    }
  };

  const handleIframeLoad = () => {
    // Inject immediately on load
    injectCSSIntoIframe(previewDesignRef.current);
    // Retry after React hydration completes in the iframe (store SPA may re-apply its own CSS variables)
    if (cssRetryTimerRef.current) clearTimeout(cssRetryTimerRef.current);
    cssRetryTimerRef.current = setTimeout(() => {
      injectCSSIntoIframe(previewDesignRef.current);
    }, 1500);
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
    <div className="flex flex-col h-full" style={{ minHeight: "560px" }}>
      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-4" style={{ maxHeight: "480px" }}>
        {messages.map((msg, index) => {
          const previousMsg = index > 0 ? messages[index - 1] : undefined;
          const showDateSeparator = shouldShowDateSeparator(msg, previousMsg);

          return (
            <div key={msg.id}>
              {/* Date separator (WhatsApp style) */}
              {showDateSeparator && msg.timestamp && (
                <div className="flex justify-center my-4">
                  <div className="bg-muted/60 px-3 py-1 rounded-full">
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatDateSeparator(msg.timestamp)}
                    </span>
                  </div>
                </div>
              )}

              {/* Message */}
              <div className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted border border-border"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="w-3.5 h-3.5" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  )}
                </div>

                {/* Bubble */}
                <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-2`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted border border-border text-foreground rounded-tl-sm"
                    }`}
                  >
                    {msg.isLoading ? (
                      <div className="flex items-center gap-1.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        {/* Timestamp (WhatsApp style - bottom right) */}
                        {msg.timestamp && (
                          <div className="flex justify-end mt-1">
                            <span
                              className={`text-[10px] ${
                                msg.role === "user"
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {formatTime(msg.timestamp)}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

              {/* Design card inline — shown under AI message */}
              {msg.design && !msg.isLoading && (
                <div className={`w-full bg-card border rounded-xl p-3 space-y-2 ${msg.isDestructive ? "border-orange-400" : "border-border"}`}>
                  {/* Destructive change warning (STRATEGY #6) */}
                  {msg.isDestructive && msg.destructiveInfo && (
                    <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-2">
                      <AlertCircle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-orange-700">
                        <span className="font-semibold">Large change detected</span>
                        {" — "}{msg.destructiveInfo.message}
                      </div>
                    </div>
                  )}

                  {/* Color swatches */}
                  {msg.design.css_variables && Object.keys(msg.design.css_variables).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(msg.design.css_variables)
                        .filter(([k]) => k !== "--radius")
                        .map(([key, value]) => (
                          <div key={key} className="flex items-center gap-1">
                            <div
                              className="w-3.5 h-3.5 rounded-full border border-border flex-shrink-0"
                              style={{ background: `hsl(${value})` }}
                            />
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {key.replace("--", "")}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Changes list */}
                  {msg.design.changes_list && msg.design.changes_list.length > 0 && (
                    <ul className="space-y-0.5">
                      {msg.design.changes_list.map((c, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                          <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Apply button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7"
                    onClick={() => handleApplyFromMessage(msg.design!, msg.historyId)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Load into Preview
                  </Button>
                </div>
              )}
            </div>
          </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* No tokens warning */}
      {!tokenBalance.has_tokens && (
        <div className="mx-3 mb-2 flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">
            No tokens.{" "}
            <button onClick={() => navigate("/admin/buy-tokens")} className="underline font-medium">
              Buy tokens
            </button>{" "}
            to generate designs.
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border px-3 py-2.5 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            tokenBalance.has_tokens
              ? "Ask for suggestions or describe a design… (Enter to send)"
              : "Buy tokens to generate designs"
          }
          disabled={isSending}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          style={{ minHeight: "40px", maxHeight: "120px" }}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={isSending || !inputValue.trim()}
          className="h-9 w-9 flex-shrink-0"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
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
          Chat with AI to redesign your store's look and feel
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
                disabled={isResetting || !currentDesign}
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
        <Card className="flex flex-col overflow-hidden">
          <CardContent className="p-0 flex-1 flex flex-col">
            {ChatPanel}
          </CardContent>
        </Card>
        <div>{PreviewPanel}</div>
      </div>

      {/* Mobile: Single view */}
      <div className="md:hidden" style={{ minHeight: "500px" }}>
        {mobileView === "chat" ? (
          <Card className="flex flex-col overflow-hidden">
            <CardContent className="p-0 flex-1 flex flex-col">
              {ChatPanel}
            </CardContent>
          </Card>
        ) : PreviewPanel}
      </div>
    </div>
  );
};

export default AIDesigner;
