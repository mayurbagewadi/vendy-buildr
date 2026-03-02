import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  ImagePlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  chatWithAI,
  applyDesign,
  applyLayer2CSS,
  resetDesign,
  getAppliedDesign,
  getLayer2CSS,
  getTokenBalance,
  buildDesignCSS,
  injectGoogleFonts,
  generateFullCSS,
  generateFullCSSStream,
  injectLayer2CSS,
  type AIDesignResult,
  type TokenBalance,
  type ChatMessage as APIChatMessage,
} from "@/lib/aiDesigner";

// ═══ STRUCTURAL SKELETON EXTRACTOR ═══
// Converts a DOM element into a clean structural skeleton for the AI.
// Keeps: tag names, data-ai attributes, id, role, structural classes (grid, flex, container)
// Removes: Tailwind utility classes, inline styles, image URLs, long text content, event handlers
// This gives the AI full visibility into the page structure without token bloat.

function extractSkeleton(el: Element, depth: number = 0, maxDepth: number = 6): string {
  if (depth > maxDepth) return '';

  const tag = el.tagName.toLowerCase();

  // Skip invisible/irrelevant elements
  if (['script', 'style', 'svg', 'path', 'noscript', 'link', 'meta'].includes(tag)) return '';

  // Build attributes: keep data-ai, id, role, href (shortened), type
  const attrs: string[] = [];
  const dataAi = el.getAttribute('data-ai');
  if (dataAi) attrs.push('data-ai="' + dataAi + '"');
  const id = el.getAttribute('id');
  if (id) attrs.push('id="' + id + '"');
  const role = el.getAttribute('role');
  if (role) attrs.push('role="' + role + '"');
  const href = el.getAttribute('href');
  if (href) attrs.push('href="' + (href.length > 30 ? href.slice(0, 30) + '...' : href) + '"');
  const type = el.getAttribute('type');
  if (type) attrs.push('type="' + type + '"');

  // Keep structural classes only (grid, flex, container, hidden, etc)
  const className = el.getAttribute('class') || '';
  const structuralClasses = className.split(/\s+/).filter((c: string) =>
    /^(grid|flex|container|hidden|block|inline|relative|absolute|fixed|sticky|overflow|gap-|space-|col-|row-|items-|justify-|md:|lg:|sm:)/.test(c)
  );
  if (structuralClasses.length > 0) attrs.push('class="' + structuralClasses.slice(0, 5).join(' ') + '"');

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  const indent = '  '.repeat(depth);

  // Self-closing tags
  if (['img', 'input', 'br', 'hr'].includes(tag)) {
    // For img, show alt but not src
    const alt = el.getAttribute('alt');
    const imgAttr = alt ? attrStr + ' alt="' + alt.slice(0, 30) + '"' : attrStr;
    return indent + '<' + tag + imgAttr + '/>\n';
  }

  // Get children
  const children = Array.from(el.children);
  const directText = Array.from(el.childNodes)
    .filter((n) => n.nodeType === 3 && n.textContent && n.textContent.trim().length > 0)
    .map((n) => (n.textContent || '').trim().slice(0, 40))
    .join(' ');

  // Leaf elements (no children) — show text content
  if (children.length === 0) {
    const text = directText || el.textContent?.trim().slice(0, 40) || '';
    if (!text) return '';
    return indent + '<' + tag + attrStr + '>' + text + '</' + tag + '>\n';
  }

  // Container elements — recurse into children
  let childHTML = '';
  for (const child of children) {
    childHTML += extractSkeleton(child, depth + 1, maxDepth);
  }

  if (!childHTML.trim() && !directText) return '';

  let result = indent + '<' + tag + attrStr + '>\n';
  if (directText) result += indent + '  ' + directText + '\n';
  result += childHTML;
  result += indent + '</' + tag + '>\n';
  return result;
}

// Capture clean HTML snapshot from iframe (called once on first load)
// Extracts full structural skeleton of each section — AI sees ALL nested elements
function captureCleanHTMLSnapshot(iframe: HTMLIFrameElement): string {
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !doc.body) return "";

  const targets = [
    { name: "header",             selector: '[data-ai="header"]' },
    { name: "hero",               selector: '[data-ai="section-hero"]' },
    { name: "categories-section", selector: '[data-ai="section-categories"]' },
    { name: "category-card",      selector: '[data-ai="category-card"]' },
    { name: "product-card",       selector: '[data-ai="product-card"]' },
    { name: "featured-section",   selector: '[data-ai="section-featured"]' },
    { name: "footer",             selector: '[data-ai="section-footer"]' },
    { name: "button",             selector: "button" },
  ];

  const parts: string[] = [];
  for (const { name, selector } of targets) {
    const el = doc.querySelector(selector);
    if (el) {
      const skeleton = extractSkeleton(el, 0, 5); // max 5 levels deep
      if (skeleton.trim()) {
        parts.push("<!-- " + name + " -->\n" + skeleton.trim());
      }
    }
  }

  const html = parts.join("\n\n");
  console.log('[HTML-SNAPSHOT] Captured structural skeleton:', { length: html.length, elementCount: parts.length });
  return html;
}

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
  const { resolvedTheme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null); // ref to the scrollable container
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isInitialScrollRef = useRef(true); // true = first load, use instant scroll
  const previewDesignRef = useRef<AIDesignResult | null>(null); // always-current ref for iframe onLoad
  const cssRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // retry CSS injection after React hydration
  const cleanHTMLSnapshotRef = useRef<string | null>(null); // Clean HTML snapshot for all AI requests (captured once on first iframe load)
  const cumulativeCSSRef = useRef<string>(''); // Tracks cumulative CSS across multiple AI turns
  const savedLayer2CSSRef = useRef<string | null>(null); // Layer 2 CSS loaded from DB on page load (persists across refreshes)
  const imageInputRef = useRef<HTMLInputElement>(null); // Hidden file input for image attachment
  const abortControllerRef = useRef<AbortController | null>(null); // Signal to abort streaming AI response

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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingDesign, setPendingDesign] = useState<AIDesignResult | null>(null);
  const [pendingHistoryId, setPendingHistoryId] = useState<string | undefined>();
  const [previewDesign, setPreviewDesign] = useState<AIDesignResult | null>(null);
  const [currentDesign, setCurrentDesign] = useState<AIDesignResult | null>(null);
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");
  const [isLoading, setIsLoading] = useState(true);
  const [cleanHTMLSnapshot, setCleanHTMLSnapshot] = useState<string | null>(null); // Clean HTML captured on first load, used for all AI requests
  const [designVersions, setDesignVersions] = useState<Array<{ id: string; design: AIDesignResult; timestamp: Date }>>([]);
  const [attachedImage, setAttachedImage] = useState<string | null>(null); // Base64 image to send with next message

  useEffect(() => {
    loadInitialData();
    return () => {
      if (cssRetryTimerRef.current) clearTimeout(cssRetryTimerRef.current);
    };
  }, []);

  // Scroll to bottom whenever messages change.
  // scrollIntoView is browser-native and handles complex layout timing internally —
  // no setTimeout needed. "instant" on first load, "smooth" for new messages.
  useEffect(() => {
    if (isLoading || messages.length === 0) return;

    if (isInitialScrollRef.current) {
      // Initial load — jump instantly to bottom (no animation)
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      isInitialScrollRef.current = false;
    } else {
      // New message — smooth scroll
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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

          // Detect Layer 1 format (css_variables) or Layer 2 format (layer2_css)
          const hasLayer1Data = aiResponse.css_variables && Object.keys(aiResponse.css_variables).length > 0;
          const hasLayer2Data = aiResponse.layer2_css && aiResponse.layer2_css.length > 0;
          const hasDesignData = hasLayer1Data || hasLayer2Data;
          const isTextMessage = aiResponse.type === "text" || (!aiResponse.type && !hasDesignData);

          if (isTextMessage) {
            // Casual text message — show as plain AI message, no design
            const textContent = aiResponse.message || aiResponse.summary || "";
            if (textContent) {
              loadedMessages.push({
                id: `ai-${record.id}`,
                role: "ai",
                content: textContent,
                timestamp,
              });
            }
          } else if (hasLayer2Data) {
            // Layer 2 format: Convert to UIMessage with design object
            const layer2Design: AIDesignResult = {
              summary: `Layer 2 design (${aiResponse.mode || 'custom'})`,
              changes_list: aiResponse.changes_list || [],
              css_variables: {}, // Layer 2 doesn't use variables
              css_overrides: aiResponse.layer2_css, // Store Layer 2 CSS
            };

            const messageContent = aiResponse.changes_list && aiResponse.changes_list.length > 0
              ? `Design applied with ${aiResponse.changes_list.length} changes`
              : "AI-generated design applied";

            loadedMessages.push({
              id: `ai-${record.id}`,
              role: "ai",
              content: messageContent,
              design: layer2Design,
              historyId: record.id,
              timestamp,
            });

            lastDesign = layer2Design;
          } else {
            // Layer 1 format: Merge ai_css_overrides back into design object for split storage
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
            if (hasLayer1Data) {
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

      const [balance, appliedDesign, layer2CSS] = await Promise.all([
        getTokenBalance(store.id),
        getAppliedDesign(store.id),
        getLayer2CSS(store.id),
      ]);

      setTokenBalance(balance);

      // Restore Layer 2 CSS from DB — so design persists after page refresh
      if (layer2CSS) {
        savedLayer2CSSRef.current = layer2CSS;
        cumulativeCSSRef.current = layer2CSS;
        console.log('[LAYER2-RESTORE] Loaded', layer2CSS.length, 'chars of Layer 2 CSS from DB');
      }

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
      .map((m): APIChatMessage | null => {
        if (m.role === "user") return { role: "user", content: m.content };
        // AI message — use clean design context, skip corrupted/empty messages
        const content = m.design
          ? `[Design proposed: ${(m.design.changes_list || []).slice(0, 5).join("; ") || m.design.summary || "visual updates"}]`
          : m.content;
        if (!content || content === "Text conversation") return null;
        return { role: "assistant", content };
      })
      .filter((m): m is APIChatMessage => m !== null);
  };

  // Build conversation history for Layer 2 (CSS-aware format).
  // AI messages include a CSS summary so the AI knows what it previously generated,
  // enabling iterative design: "now make buttons green" knows what came before.
  const buildLayer2History = (uiMessages: UIMessage[]): APIChatMessage[] => {
    return uiMessages
      .filter((m) => m.id !== "welcome" && !m.isLoading)
      .map((m): APIChatMessage | null => {
        if (m.role === "user") return { role: "user", content: m.content };
        // AI message: summarize what CSS was generated so AI has design memory
        if (m.design?.css_overrides) {
          const selectorCount = (m.design.css_overrides.match(/[^}]+\{/g) || []).length;
          const changes = (m.design.changes_list || []).slice(0, 4).join("; ");
          const content = "[Applied CSS — " + selectorCount + " rules. Changes: " + (changes || m.design.summary) + "]";
          return { role: "assistant", content };
        }
        if (m.design) {
          const vars = Object.keys(m.design.css_variables || {}).slice(0, 5).join(", ");
          const changes = (m.design.changes_list || []).slice(0, 4).join("; ");
          const content = "[Updated CSS variables: " + vars + ". Changes: " + (changes || m.design.summary) + "]";
          return { role: "assistant", content };
        }
        if (!m.content || m.content === "Text conversation") return null;
        return { role: "assistant", content: m.content };
      })
      .filter((m): m is APIChatMessage => m !== null)
      .slice(-8); // last 8 messages to control token usage
  };

  // Compress image client-side to max 1024px JPEG before sending to AI
  // Reduces token cost significantly (12MP camera photo → ~150KB compressed)
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
        if (height > MAX) { width = Math.round((width * MAX) / height); height = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = objectUrl;
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so same file can be selected again
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image too large. Max 10MB.");
      return;
    }
    try {
      const compressed = await compressImage(file);
      setAttachedImage(compressed);
    } catch {
      toast.error("Failed to read image.");
    }
  };

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsSending(false);
    inputRef.current?.focus();
    toast.success("Generation stopped");
  };

  const handleSend = async () => {
    if (!storeId || !userId) return;
    const text = inputValue.trim();
    if (!text) return;

    // ═══ BASIC VALIDATION ONLY ═══
    if (!text || text.trim().length === 0) {
      return;
    }

    const userMsgId = `user-${Date.now()}`;
    const now = new Date();

    const userMsg: UIMessage = {
      id: userMsgId,
      role: "user",
      content: text,
      timestamp: now,
    };

    // ═══ NON-DESIGN PROMPT DETECTION ═══
    // Detect greetings, questions, etc. — respond instantly without calling AI or spending tokens
    const lower = text.toLowerCase().replace(/[^a-z\s?]/g, '').trim();
    const greetings = ['hi', 'hey', 'hello', 'hii', 'hiii', 'yo', 'sup', 'hola', 'namaste', 'good morning', 'good evening', 'good afternoon', 'good night', 'whats up', 'wassup'];
    const questionPhrases = ['what can you do', 'who are you', 'help', 'how does this work', 'what is this', 'how to use', 'what do you do'];
    const isGreeting = greetings.some((g) => lower === g || lower === g + '?');
    const isQuestion = questionPhrases.some((q) => lower.startsWith(q));

    if (isGreeting || isQuestion) {
      const response = isGreeting
        ? "Hey! I'm your AI Designer. Tell me how you'd like your store to look — try something like \"make it modern and minimal\" or \"use a warm earthy theme with rounded buttons\"."
        : "I'm your AI Designer! I can redesign your store's colors, layout, fonts, and style. Just describe what you want — for example:\n\n• \"Make it look premium and elegant\"\n• \"Use a green nature theme\"\n• \"Make buttons rounded and cards have shadows\"\n• \"Give me a dark mode luxury feel\"";
      const aiMsg: UIMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setInputValue("");
      return;
    }

    const loadingMsgId = `loading-${Date.now()}`;
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
      // ═══ LAYER 2: Use clean HTML snapshot for AI context ═══
      const iframe = iframeRef.current;

      // Use the clean HTML snapshot (captured once on first load) instead of extracting from live iframe
      // This avoids stale/cached HTML that causes the "second request fails" issue
      const cleanHTML = cleanHTMLSnapshotRef.current;

      console.log('[AI-PATH] cleanHTMLSnapshot available:', !!cleanHTML, cleanHTML ? '(' + cleanHTML.length + ' chars)' : '(null - will use Layer 1 fallback)');

      if (cleanHTML) {
        // Use Layer 2 (Full CSS Generation with HTML access)
        console.log('[LAYER2] ✅ Using Layer 2 with clean HTML snapshot');
        console.log('[LAYER2] HTML Snapshot size:', cleanHTML.length, 'chars');

        try {
        // Build conversation history for Layer 2 — AI gets CSS context from previous turns
        const allMessages = [...messages, userMsg];
        const layer2History = buildLayer2History(allMessages);
        console.log('[LAYER2] Passing', layer2History.length, 'messages to AI as conversation history');

        // Create AbortController for this request — user can cancel anytime
        abortControllerRef.current = new AbortController();

        // Stream AI response — show text progressively in chat
        let streamedText = '';
        const layer2Result = await generateFullCSSStream(
          storeId,
          userId,
          cleanHTML.slice(0, 6000), // Structural skeleton — all sections fit within ~4-5K chars
          null, // Layer 1 data not available - AI will work with HTML context alone
          text,
          layer2History,
          (chunk) => {
            // Option B: Buffer all chunks, only show SUMMARY section text progressively
            // CSS code (before SUMMARY:) is hidden behind loading spinner
            streamedText += chunk;

            const summaryIdx = streamedText.indexOf('SUMMARY:');
            if (summaryIdx === -1) return; // Still in CSS section — keep spinner

            // Extract only the conversational text after SUMMARY:, stop at CHANGES:
            const afterSummary = streamedText.slice(summaryIdx + 8).trimStart();
            const changesIdx = afterSummary.indexOf('CHANGES:');
            const visibleText = changesIdx !== -1
              ? afterSummary.slice(0, changesIdx).trimEnd()
              : afterSummary;

            if (!visibleText) return; // Nothing to show yet

            setMessages((prev) => prev.map((m) =>
              m.id === loadingMsgId
                ? { ...m, content: visibleText, isLoading: false }
                : m
            ));
          },
          resolvedTheme === "dark" ? "dark" : "light", // Tell AI which mode the store is currently in
          attachedImage || undefined, // Vision: pass image if user attached one
          abortControllerRef.current!.signal, // Allow user to cancel
        );
        setAttachedImage(null); // Clear image after send

        // ═══ DEEP DEBUG LOGGING - LAYER 2 CHANGES ═══
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🎨 [LAYER2 CHANGES] AI Design Generation Complete");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

        console.log("📊 LAYER 2 RESULT:");
        console.log("  ├─ CSS Length:", layer2Result.css.length, "chars");
        console.log("  ├─ Changes Count:", layer2Result.changes_list?.length || 0);
        console.log("  ├─ Message:", layer2Result.message);
        console.log("  └─ Tokens Remaining:", layer2Result.tokens_remaining);

        if (layer2Result.changes_list && layer2Result.changes_list.length > 0) {
          console.log("\n📝 DETAILED CHANGES BREAKDOWN:");
          layer2Result.changes_list.forEach((change, idx) => {
            console.log(`  ${idx + 1}. ${change}`);
          });
        }

        console.log("\n💅 CSS PREVIEW (first 500 chars):");
        console.log(layer2Result.css.substring(0, 500));
        if (layer2Result.css.length > 500) {
          console.log(`  ...(+${layer2Result.css.length - 500} more chars)`);
        }

        // Count what was changed
        const cssAnalysis = {
          selectors: (layer2Result.css.match(/[^}]+\{/g) || []).length,
          classSelectors: (layer2Result.css.match(/\.[a-zA-Z-_]+/g) || []).length,
          dataAttributes: (layer2Result.css.match(/\[data-[a-zA-Z-]+/g) || []).length,
          importantRules: (layer2Result.css.match(/!important/g) || []).length,
          gradients: (layer2Result.css.match(/linear-gradient|radial-gradient/g) || []).length,
          blurEffects: (layer2Result.css.match(/backdrop-filter:|blur\(/g) || []).length,
          shadows: (layer2Result.css.match(/box-shadow:|text-shadow:/g) || []).length,
          transforms: (layer2Result.css.match(/transform:/g) || []).length,
        };

        console.log("\n🔍 CSS ANALYSIS:");
        console.log("  ├─ Total Selectors:", cssAnalysis.selectors);
        console.log("  ├─ Class Selectors:", cssAnalysis.classSelectors);
        console.log("  ├─ Data Attributes:", cssAnalysis.dataAttributes);
        console.log("  ├─ !important Rules:", cssAnalysis.importantRules);
        console.log("  ├─ Gradients:", cssAnalysis.gradients);
        console.log("  ├─ Blur Effects:", cssAnalysis.blurEffects);
        console.log("  ├─ Shadows:", cssAnalysis.shadows);
        console.log("  └─ Transforms:", cssAnalysis.transforms);

        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

        // Server returns merged CSS (existing + new) — track locally and inject
        cumulativeCSSRef.current = layer2Result.css;

        // Inject merged CSS into preview
        if (iframe) {
          injectLayer2CSS(iframe, layer2Result.css);
        }

        // Format AI message with Layer 2 design data for rich UI display
        const layer2Design: AIDesignResult = {
          summary: layer2Result.message || "AI-generated design applied",
          changes_list: layer2Result.changes_list || [],
          css_variables: {}, // Layer 2 uses full CSS, not just variables
          css_overrides: layer2Result.css, // Store Layer 2 CSS in overrides
        };

        // Enable Publish button — mark this design as pending
        setPendingDesign(layer2Design);
        setPendingHistoryId(undefined); // Layer 2 has no history_id (CSS stored directly in DB)

        const aiMsg: UIMessage = {
          id: `ai-${Date.now()}`,
          role: "ai",
          content: layer2Result.message || "AI-generated design applied",
          design: layer2Design, // Add design object for rich UI
          timestamp: new Date(),
        };

        setMessages((prev) => prev.map((m) => m.id === loadingMsgId ? aiMsg : m));

        // Store design version for history/comparison
        const versionId = `v-${Date.now()}`;
        setDesignVersions((prev) => [...prev, {
          id: versionId,
          design: layer2Design,
          timestamp: new Date(),
        }]);

        // Update tokens
        setTokenBalance((prev) => ({
          ...prev,
          tokens_remaining: layer2Result.tokens_remaining,
          has_tokens: layer2Result.tokens_remaining > 0,
        }));

        toast.success("Design applied using Layer 2!");
        } catch (layer2Error: any) {
          // Handle abort (user-initiated cancel)
          if (layer2Error.name === 'AbortError') {
            // User clicked Stop button — remove loading message
            setMessages((prev) => prev.filter((m) => m.id !== loadingMsgId));
            console.log('[LAYER2] Generation cancelled by user');
          } else {
            console.error('[LAYER2] Error:', layer2Error);
            toast.error("Design generation failed: " + (layer2Error.message || 'Unknown error'));
          }
        }
      } else {
        // Fallback to Layer 1 if HTML snapshot not captured (iframe not ready)
        console.warn('[AI-PATH] ⚠️ No HTML snapshot — using Layer 1 (CSS variables only). [data-ai] elements may not have rendered yet.');

        // Limit to last 20 messages to avoid request size issues
        const recentMessages = [...messages, userMsg].slice(-20);
        console.log('[API-DEBUG] Sending', recentMessages.length, 'messages (limited from', messages.length + 1, 'total)');
        const history = buildAPIHistory(recentMessages);
        const result = await chatWithAI(storeId, userId, history, (resolvedTheme === "dark" ? "dark" : "light"));
        console.log('[AI-DEBUG] chatWithAI result:', JSON.stringify({ type: result.type, hasDesign: !!result.design, message: result.message?.slice(0, 80), css_variables: result.design?.css_variables, css_overrides_length: result.design?.css_overrides?.length }));

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

        setMessages((prev) => prev.map((m) => m.id === loadingMsgId ? aiMsg : m));

        if (result.type === "design" && result.design) {
          setPendingDesign(result.design);
          setPendingHistoryId(result.history_id);
          previewDesignRef.current = result.design;
          setPreviewDesign(result.design);
          injectCSSIntoIframe(result.design);

          // Store design version for history/comparison
          const versionId = `v-${Date.now()}`;
          setDesignVersions((prev) => [...prev, {
            id: versionId,
            design: result.design,
            timestamp: new Date(),
          }]);

          if (result.tokens_remaining !== undefined) {
            setTokenBalance((prev) => ({
              ...prev,
              tokens_remaining: result.tokens_remaining!,
              has_tokens: result.tokens_remaining! > 0,
            }));
          }
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

    // Track this as a version if it's not already tracked
    const versionId = `v-${historyId || Date.now()}`;
    const exists = designVersions.some(v => v.id === versionId);
    if (!exists) {
      setDesignVersions((prev) => [...prev, {
        id: versionId,
        design: design,
        timestamp: new Date(),
      }]);
    }

    toast.success("Design loaded into preview. Click Publish to go live.");
  };

  const buildPublishConfirmationMessage = (prevDesign: AIDesignResult | null, newDesign: AIDesignResult): string => {
    const changes: string[] = [];

    // Compare css_variables
    const prevVars = prevDesign?.css_variables || {};
    const newVars = newDesign.css_variables || {};
    const varLabels: Record<string, string> = {
      primary: "Primary color",
      background: "Background color",
      foreground: "Text color",
      card: "Card background",
      muted: "Muted background",
      "muted-foreground": "Secondary text color",
      border: "Border color",
      radius: "Border radius",
    };
    for (const [key, label] of Object.entries(varLabels)) {
      if (newVars[key] !== undefined && newVars[key] !== prevVars[key]) {
        changes.push(`${label}: \`${newVars[key]}\``);
      }
    }
    // Any extra vars not in the standard set
    for (const key of Object.keys(newVars)) {
      if (!varLabels[key] && newVars[key] !== prevVars[key]) {
        changes.push(`CSS variable \`${key}\`: updated`);
      }
    }

    // Compare layout
    const prevLayout = prevDesign?.layout || {};
    const newLayout = newDesign.layout || {};
    if (newLayout.product_grid_cols && newLayout.product_grid_cols !== prevLayout.product_grid_cols) {
      changes.push(`Product grid: ${newLayout.product_grid_cols} columns`);
    }
    if (newLayout.section_padding && newLayout.section_padding !== prevLayout.section_padding) {
      changes.push(`Section spacing: ${newLayout.section_padding}`);
    }
    if (newLayout.hero_style && newLayout.hero_style !== prevLayout.hero_style) {
      changes.push(`Hero banner style: ${newLayout.hero_style}`);
    }

    // CSS overrides changed?
    if (newDesign.css_overrides && newDesign.css_overrides !== prevDesign?.css_overrides) {
      changes.push("Custom CSS overrides: applied");
    }

    if (changes.length === 0) {
      return "✅ Design is live on your store! No visible differences from the previous design were detected.";
    }

    const list = changes.map(c => `• ${c}`).join("\n");
    return `✅ Design confirmed live on your store!\n\n**Changes now active:**\n${list}\n\nAll ${changes.length} change${changes.length === 1 ? "" : "s"} verified. Want to adjust anything?`;
  };

  const handlePublish = async () => {
    if (!storeId || !pendingDesign) {
      toast.error("No design to publish. Ask AI to generate a design first.");
      return;
    }
    setIsPublishing(true);
    const previousDesign = currentDesign; // snapshot before state update
    try {
      const isLayer2Design = !!pendingDesign.css_overrides && Object.keys(pendingDesign.css_variables || {}).length === 0;
      if (isLayer2Design) {
        // Layer 2: explicitly save CSS to DB so customer store sees it
        // Never assume DB was updated during generation — always write on Publish
        await applyLayer2CSS(storeId, pendingDesign.css_overrides!);
      } else {
        // Layer 1: apply CSS variables to live store
        await applyDesign(storeId, pendingDesign, pendingHistoryId);
      }
      const publishedDesign = pendingDesign;
      setCurrentDesign(publishedDesign);
      setPendingDesign(null);
      setPendingHistoryId(undefined);
      // Clear reset flag — user has published a new design
      localStorage.removeItem(`ai_designer_reset_${storeId}`);
      toast.success("Design published to your live store!");
      // Add confirmation message to chat
      const confirmMsg = buildPublishConfirmationMessage(previousDesign, publishedDesign);
      setMessages(prev => [...prev, {
        id: `publish-confirm-${Date.now()}`,
        role: "ai",
        content: confirmMsg,
        timestamp: new Date(),
      }]);
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
      // Clear HTML snapshot, cumulative CSS, saved Layer 2 CSS, and versions when user resets (starts fresh)
      cleanHTMLSnapshotRef.current = null;
      setCleanHTMLSnapshot(null);
      cumulativeCSSRef.current = '';
      savedLayer2CSSRef.current = null;
      setDesignVersions([]);
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
      console.log('[AI-DEBUG] injectCSSIntoIframe called, design:', !!design, 'iframe:', !!iframe, 'contentDocument:', !!iframe?.contentDocument, 'head:', !!iframe?.contentDocument?.head);
      if (!iframe?.contentDocument?.head) {
        console.warn('[AI-DEBUG] Cannot inject — iframe head not accessible');
        return;
      }
      const existing = iframe.contentDocument.getElementById('ai-preview-styles');
      if (existing) existing.remove();
      if (!design) {
        // Also remove Google Fonts when clearing design
        injectGoogleFonts(iframe.contentDocument);
        return;
      }
      const css = buildDesignCSS(design);
      console.log('[AI-DEBUG] Generated CSS length:', css.length, '\n', css.slice(0, 300));
      const styleEl = iframe.contentDocument.createElement('style');
      styleEl.id = 'ai-preview-styles';
      styleEl.textContent = css;
      iframe.contentDocument.head.appendChild(styleEl);
      // Inject Google Fonts
      injectGoogleFonts(iframe.contentDocument, design.fonts);
      console.log('[AI-DEBUG] CSS + fonts injected successfully into iframe head');
    } catch (err) {
      console.error('[AI-DEBUG] CSS injection failed (likely cross-origin):', err);
    }
  };

  const handleIframeLoad = () => {
    console.log('[AI-DEBUG] iframe onLoad fired, previewDesign in ref:', !!previewDesignRef.current);

    // CAPTURE CLEAN HTML SNAPSHOT — retry with delays for React hydration
    // The iframe loads an HTML shell first, then React mounts [data-ai] elements.
    // onLoad fires before React hydrates, so we retry until elements appear.
    const attemptSnapshotCapture = (attempt: number) => {
      if (cleanHTMLSnapshotRef.current || !iframeRef.current) return; // already captured or no iframe

      const snapshot = captureCleanHTMLSnapshot(iframeRef.current);
      if (snapshot && snapshot.length > 0) {
        cleanHTMLSnapshotRef.current = snapshot;
        setCleanHTMLSnapshot(snapshot);
        console.log('[HTML-SNAPSHOT] Captured on attempt', attempt + 1, '- length:', snapshot.length);
      } else if (attempt < 5) {
        // React hasn't rendered [data-ai] elements yet — retry
        const delays = [500, 1500, 3000, 5000, 8000];
        console.log('[HTML-SNAPSHOT] Attempt', attempt + 1, 'found no elements, retrying in', delays[attempt] + 'ms');
        setTimeout(() => attemptSnapshotCapture(attempt + 1), delays[attempt]);
      } else {
        console.warn('[HTML-SNAPSHOT] All 5 attempts failed — no [data-ai] elements found. Layer 2 will not be available.');
      }
    };
    attemptSnapshotCapture(0);

    // Inject immediately on load
    injectCSSIntoIframe(previewDesignRef.current);
    if (savedLayer2CSSRef.current && iframeRef.current) {
      injectLayer2CSS(iframeRef.current, savedLayer2CSSRef.current);
    }
    // Retry multiple times to survive React hydration and lazy CSS loading in the iframe
    if (cssRetryTimerRef.current) clearTimeout(cssRetryTimerRef.current);
    const retries = [500, 1500, 3000];
    retries.forEach((delay) => {
      setTimeout(() => {
        injectCSSIntoIframe(previewDesignRef.current);
        if (savedLayer2CSSRef.current && iframeRef.current) {
          injectLayer2CSS(iframeRef.current, savedLayer2CSSRef.current);
        }
      }, delay);
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
    <div className="flex flex-col h-full" style={{ minHeight: "560px" }}>
      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-4" style={{ maxHeight: "480px" }}>
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

                  {/* Color palette preview (no technical names) */}
                  {msg.design.css_variables && Object.keys(msg.design.css_variables).length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground mr-1">Colors:</span>
                      <div className="flex -space-x-1">
                        {Object.entries(msg.design.css_variables)
                          .filter(([k, v]) => k !== "radius" && !k.includes("foreground") && typeof v === "string" && v.includes("%"))
                          .slice(0, 6)
                          .map(([key, value]) => (
                            <div
                              key={key}
                              className="w-4 h-4 rounded-full border-2 border-background shadow-sm"
                              style={{ background: `hsl(${value})` }}
                              title={key.replace("--", "").replace("-", " ")}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Changes list — rich display with section name + description */}
                  {msg.design.changes_list && msg.design.changes_list.length > 0 && (
                    <ul className="space-y-2 mt-1">
                      {msg.design.changes_list.map((c, i) => {
                        const arrowIdx = c.indexOf(" → ");
                        const section = arrowIdx !== -1 ? c.slice(0, arrowIdx) : c;
                        const desc = arrowIdx !== -1 ? c.slice(arrowIdx + 3) : "";
                        // Cycle through accent colors for visual variety
                        const colors = [
                          "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                          "bg-violet-500/10 text-violet-600 dark:text-violet-400",
                          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                          "bg-orange-500/10 text-orange-600 dark:text-orange-400",
                          "bg-pink-500/10 text-pink-600 dark:text-pink-400",
                          "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
                        ];
                        const color = colors[i % colors.length];
                        return (
                          <li key={i} className="flex flex-col gap-0.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${color}`}>
                              <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0" />
                              {section.replace(/\[data-ai="([^"]+)"\]/g, '$1')}
                            </span>
                            {desc && (
                              <p className="text-xs text-muted-foreground leading-relaxed pl-1">
                                {desc.replace(/\[data-ai="([^"]+)"\]/g, '$1')}
                              </p>
                            )}
                          </li>
                        );
                      })}
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

      {/* Design Version History */}
      {designVersions.length > 0 && (
        <div className="border-t border-border px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Design Versions ({designVersions.length})</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {designVersions.map((version, idx) => (
              <Button
                key={version.id}
                variant={previewDesign === version.design ? "default" : "outline"}
                size="sm"
                className="text-xs whitespace-nowrap flex-shrink-0"
                onClick={() => handleApplyFromMessage(version.design, version.id)}
              >
                v{idx + 1}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border px-3 py-2.5">
        {/* Image thumbnail — shown above bar when attached */}
        {attachedImage && (
          <div className="mb-1.5 flex items-center gap-2">
            <div className="relative inline-block">
              <img
                src={attachedImage}
                alt="Attached"
                className="h-10 w-10 object-cover rounded-md border border-border"
              />
              <button
                onClick={() => setAttachedImage(null)}
                className="absolute -top-1 -right-1 bg-background border border-border rounded-full w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground">Image attached</span>
          </div>
        )}

        {/* Unified input bar */}
        <div className="flex items-center gap-1.5 rounded-xl border border-input bg-background px-2.5 py-2 focus-within:ring-1 focus-within:ring-ring">
          {/* Image attach icon — inside the bar */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isSending}
            title="Attach image reference"
            className={`flex-shrink-0 transition-colors disabled:opacity-40 ${
              attachedImage
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ImagePlus className="w-7 h-7" />
          </button>

          {/* Hidden file input */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />

          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              tokenBalance.has_tokens
                ? "Describe a design or ask for suggestions…"
                : "Buy tokens to generate designs"
            }
            disabled={isSending}
            rows={2}
            className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 py-1"
            style={{ maxHeight: "115px" }}
          />

          <Button
            size="icon"
            onClick={isSending ? handleStopGeneration : handleSend}
            disabled={!isSending && !inputValue.trim()}
            className="flex-shrink-0 h-9 w-9 rounded-lg"
            variant={isSending ? "destructive" : "default"}
          >
            {isSending ? (
              <X className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
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
                onClick={() => setShowResetConfirm(true)}
                disabled={isResetting}
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

      {/* Reset confirmation dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-destructive" />
              Reset to Default Design?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all AI-applied customizations and restore your store to the
              <strong> platform default design</strong> — the standard look every new store starts with.
              <br /><br />
              Your chat history and generated designs will not be deleted. You can re-apply any design from the chat at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleReset}
            >
              Yes, Reset to Default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AIDesigner;
