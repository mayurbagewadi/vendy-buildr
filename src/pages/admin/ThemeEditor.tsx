import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Reorder, useDragControls } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  FileEdit,
  RotateCcw,
  Upload,
  GripVertical,
  Loader2,
  Eye,
  EyeOff,
  Layers,
  Check,
  Bell,
  Menu,
  MonitorSmartphone,
  LayoutDashboard,
  ShoppingBag,
  Star,
  Instagram,
  Package,
  Send,
  Sparkles,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  loadStoreThemeState,
  saveDraftThemeState,
  publishDraftThemeState,
  loadStoreThemeSnapshots,
  rollbackStoreThemeSnapshot,
  type StoreThemeState,
  type StoreThemeSnapshot,
} from "@/lib/storeThemeState";
import { getStorefrontThemeByTemplate } from "@/new-storefront/themes/registry";
import { normalizeThemePageLayout } from "@/new-storefront/theme-engine/layout";
import type {
  StorefrontThemeRuntimeDefinition,
  ThemeSectionInstance,
} from "@/new-storefront/theme-engine/types";
import { ThemeEditorInspector } from "./ThemeEditorInspector";
import { themeChatRequest, type ChatTurn } from "@/lib/themeChatAI";

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionWithLabel = ThemeSectionInstance & { label: string };

// ─── Section icon map ─────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, LucideIcon> = {
  "announcement-bar": Bell,
  "header": Menu,
  "hero": MonitorSmartphone,
  "featured-categories": LayoutDashboard,
  "featured-products": ShoppingBag,
  "reviews": Star,
  "instagram-reels": Instagram,
  "footer": Layers,
};

// ─── CSS injection (draft preview) ───────────────────────────────────────────

const PREVIEW_CSS_ID = "te-draft-css";

function injectPreviewCSS(iframe: HTMLIFrameElement, css: string | null): void {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return;
    let el = doc.getElementById(PREVIEW_CSS_ID) as HTMLStyleElement | null;
    if (!el) {
      el = doc.createElement("style");
      el.id = PREVIEW_CSS_ID;
      doc.head.appendChild(el);
    }
    el.textContent = css ?? "";
  } catch {
    // cross-origin — silent
  }
}

// ─── Section row (drag + toggle) ──────────────────────────────────────────────

function SectionRow({
  section,
  selected,
  onSelect,
  onToggle,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  section: SectionWithLabel;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const controls = useDragControls();
  const Icon: LucideIcon = SECTION_ICONS[section.type] ?? Package;

  const handleGripPointerDown = (e: React.PointerEvent) => {
    onDragStart?.();
    controls.start(e);
  };

  return (
    <Reorder.Item
      value={section}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, zIndex: 50 }}
      className="outline-none list-none group"
    >
      <div
        onClick={() => onSelect(section.id)}
        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm select-none transition-colors ${
          selected
            ? "border-primary bg-primary/10"
            : section.visible
            ? "border-border bg-card hover:bg-muted/40"
            : "border-border/40 bg-muted/20 text-muted-foreground"
        }`}
      >
        <div
          onPointerDown={handleGripPointerDown}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <Icon
          className={`h-4 w-4 shrink-0 ${
            section.visible ? "text-muted-foreground" : "text-muted-foreground/50"
          }`}
        />
        <span
          className={`flex-1 truncate text-sm font-medium ${
            selected || section.visible ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {section.label}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(section.id); }}
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          title={section.visible ? "Hide section" : "Show section"}
        >
          {section.visible ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(section.id); }}
          className="shrink-0 rounded p-0.5 text-muted-foreground/0 transition-all hover:text-destructive group-hover:text-muted-foreground/60"
          title="Remove section"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </Reorder.Item>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ThemeEditor() {
  // Store identity
  const [storeId, setStoreId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeUrl, setStoreUrl] = useState<string | null>(null);
  const [storeTemplate, setStoreTemplate] = useState<string | null>(null);

  // Theme state
  const [themeState, setThemeState] = useState<StoreThemeState | null>(null);
  const [snapshots, setSnapshots] = useState<StoreThemeSnapshot[]>([]);

  // Section panel
  const [sections, setSections] = useState<SectionWithLabel[]>([]);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [isDraggingSections, setIsDraggingSections] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  // AI chat state
  type ChatMessage = { role: "user" | "ai"; text: string };
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const aiTurnHistoryRef = useRef<ChatTurn[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const [isDraggingResize, setIsDraggingResize] = useState(false);

  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-fresh refs for async saves
  const storeIdRef = useRef<string | null>(null);
  const storeTemplateRef = useRef<string | null>(null);
  const themeStateRef = useRef<StoreThemeState | null>(null);

  // Keep refs in sync
  storeIdRef.current = storeId;
  storeTemplateRef.current = storeTemplate;
  themeStateRef.current = themeState;

  // ── Load store + theme state ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session || cancelled) return;

        const { data: store, error: storeError } = await supabase
          .from("stores")
          .select("id, name, slug, subdomain, storefront_template")
          .eq("user_id", session.user.id)
          .single();

        if (storeError || !store || cancelled) {
          if (!cancelled) setLoadError(true);
          return;
        }

        const template = (store.storefront_template as string | null) ?? null;
        setStoreId(store.id as string);
        setUserId(session.user.id);
        setStoreName((store.name as string) ?? "My Store");
        setStoreTemplate(template);

        const hostname = window.location.hostname;
        const isSubdomain =
          store.subdomain &&
          hostname.startsWith((store.subdomain as string) + ".");
        const url = isSubdomain
          ? `${window.location.origin}/`
          : `${window.location.origin}/${store.slug}`;
        setStoreUrl(url as string);

        const [state, snaps] = await Promise.all([
          loadStoreThemeState(store.id as string),
          loadStoreThemeSnapshots(store.id as string),
        ]);

        if (!cancelled) {
          setThemeState(state);
          setSnapshots(snaps);
          initSections(template, state);
        }
      } catch (e) {
        console.error("[ThemeEditor] load error:", e);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Section initialisation ─────────────────────────────────────────────────
  function initSections(
    template: string | null,
    state: StoreThemeState | null
  ) {
    const manifest = getStorefrontThemeByTemplate(template);
    if (!manifest) {
      setSections([]);
      return;
    }

    const homeSchema = manifest.sectionSchema.filter((s) => s.page === "home");
    const schemaMap = new Map(homeSchema.map((s) => [s.type, s]));

    const normalized = normalizeThemePageLayout(
      { sectionSchema: manifest.sectionSchema } as StorefrontThemeRuntimeDefinition,
      "home",
      state?.draft_page_layout ?? {}
    ).sections;

    // Append any schema sections missing from saved layout (e.g. newly added types)
    const existingTypes = new Set(normalized.map((s) => s.type));
    homeSchema.forEach((schema, i) => {
      if (!existingTypes.has(schema.type)) {
        normalized.push({
          id: `${schema.type}-default`,
          type: schema.type,
          order: normalized.length + i,
          visible: schema.defaultVisible !== false,
          settings: {},
          blocks: [],
        });
      }
    });

    setSections(
      normalized.map((s) => ({
        ...s,
        label: schemaMap.get(s.type)?.label ?? s.type,
      }))
    );
  }

  // ── Inject draft CSS ───────────────────────────────────────────────────────
  useEffect(() => {
    if (iframeReady && iframeRef.current) {
      injectPreviewCSS(iframeRef.current, themeState?.draft_custom_css ?? null);
    }
  }, [themeState, iframeReady]);

  const handleIframeLoad = () => setIframeReady(true);

  // ── Resize drag ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - dragStartX.current;
      const maxW = containerRef.current?.clientWidth ?? 1440;
      const next = Math.max(320, Math.min(dragStartW.current + delta, maxW));
      setPreviewWidth(next);
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        setIsDraggingResize(false);
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setIsDraggingResize(true);
    dragStartX.current = e.clientX;
    dragStartW.current =
      previewWidth ?? containerRef.current?.clientWidth ?? 1024;
  };

  // ── Section auto-save (debounced 800ms) ────────────────────────────────────
  function scheduleSave(updated: SectionWithLabel[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const sid = storeIdRef.current;
      const ts = themeStateRef.current;
      const tmpl = storeTemplateRef.current;
      if (!sid) return;
      setSaving(true);
      try {
        // Strip UI-only `label` field before persisting
        const payload = updated.map(({ label: _label, ...s }, i) => ({
          ...s,
          order: i,
        }));
        const result = await saveDraftThemeState({
          storeId: sid,
          themeId: ts?.draft_theme_id ?? tmpl ?? "default",
          themeVersion: ts?.draft_theme_version ?? null,
          settings: ts?.draft_settings ?? {},
          pageLayout: { sections: payload },
          customCss: ts?.draft_custom_css ?? null,
        });
        themeStateRef.current = result;
        setThemeState(result);
        setSavedAt(new Date());
      } catch (e) {
        console.error("[ThemeEditor] section save error:", e);
      } finally {
        setSaving(false);
      }
    }, 800);
  }

  const handleReorder = (newOrder: SectionWithLabel[]) => {
    const updated = newOrder.map((s, i) => ({ ...s, order: i }));
    setSections(updated);
    scheduleSave(updated);
  };

  const handleToggleVisible = (id: string) => {
    const updated = sections.map((s) =>
      s.id === id ? { ...s, visible: !s.visible } : s
    );
    setSections(updated);
    scheduleSave(updated);
  };

  const handleSectionSelect = (id: string) => {
    setSelectedSectionId((prev) => (prev === id ? null : id));
  };

  const handleSectionSettingChange = (fieldId: string, value: unknown) => {
    if (!selectedSectionId) return;
    const updated = sections.map((s) =>
      s.id === selectedSectionId
        ? { ...s, settings: { ...(s.settings ?? {}), [fieldId]: value } }
        : s
    );
    setSections(updated);
    scheduleSave(updated);
  };

  const handleDeleteSection = (id: string) => {
    if (selectedSectionId === id) setSelectedSectionId(null);
    const updated = sections
      .filter((s) => s.id !== id)
      .map((s, i) => ({ ...s, order: i }));
    setSections(updated);
    scheduleSave(updated);
  };

  const handleAddSection = (type: string) => {
    const schemaEntry = manifest?.sectionSchema.find((s) => s.type === type);
    if (!schemaEntry) return;
    const newSection: SectionWithLabel = {
      id: `${type}-${Date.now()}`,
      type,
      order: sections.length,
      visible: schemaEntry.defaultVisible !== false,
      settings: {},
      blocks: [],
      label: schemaEntry.label,
    };
    const updated = [...sections, newSection];
    setSections(updated);
    scheduleSave(updated);
    setShowAddSectionModal(false);
  };

  // ── AI chat send ──────────────────────────────────────────────────────────
  const handleChatSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || aiThinking || !storeId || !userId) return;

    setChatInput("");
    setChatHistory((prev) => [...prev, { role: "user", text: trimmed }]);
    setAiThinking(true);

    // Scroll chat to bottom
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }, 50);

    try {
      // Strip label (UI-only) before sending to AI
      const currentSectionsPayload = sections.map(({ label: _label, ...s }) => s as Record<string, unknown>);

      const result = await themeChatRequest({
        storeId,
        userId,
        prompt: trimmed,
        history: aiTurnHistoryRef.current,
        currentSections: currentSectionsPayload,
      });

      // Update conversation history for next turn
      aiTurnHistoryRef.current = [
        ...aiTurnHistoryRef.current,
        { role: "user", content: trimmed },
        { role: "assistant", content: result.message },
      ].slice(-12); // keep last 12 messages (6 turns)

      // Apply AI result to sections
      const schemaMap = manifest
        ? new Map(manifest.sectionSchema.map((s) => [s.type, s]))
        : new Map();

      let updatedSections: SectionWithLabel[];

      if (result.intent === "build") {
        // Full replacement: AI provides the complete new section list
        updatedSections = result.sections.map((s, i) => ({
          ...s,
          order: i,
          settings: s.settings as Record<string, unknown>,
          label: schemaMap.get(s.type)?.label ?? s.type,
        }));
      } else {
        // Patch: merge AI's changes into existing sections
        updatedSections = [...sections];
        for (const aiSection of result.sections) {
          const existingIdx = updatedSections.findIndex(
            (s) => s.id === aiSection.id || s.type === aiSection.type
          );
          if (existingIdx >= 0) {
            updatedSections[existingIdx] = {
              ...updatedSections[existingIdx],
              visible: aiSection.visible,
              settings: {
                ...(updatedSections[existingIdx].settings ?? {}),
                ...(aiSection.settings ?? {}),
              },
            };
          } else {
            // New section added by AI
            updatedSections.push({
              ...aiSection,
              settings: aiSection.settings as Record<string, unknown>,
              label: schemaMap.get(aiSection.type)?.label ?? aiSection.type,
            });
          }
        }
        updatedSections.sort((a, b) => a.order - b.order);
      }

      setSections(updatedSections);
      scheduleSave(updatedSections);

      setChatHistory((prev) => [...prev, { role: "ai", text: result.message }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setChatHistory((prev) => [...prev, { role: "ai", text: msg }]);
    } finally {
      setAiThinking(false);
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 50);
    }
  };

  // ── Publish ────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!storeId) return;
    setPublishing(true);
    try {
      const updated = await publishDraftThemeState(storeId);
      setThemeState(updated);
      const snaps = await loadStoreThemeSnapshots(storeId);
      setSnapshots(snaps);
      setShowPublishDialog(false);
      if (iframeRef.current?.src) {
        iframeRef.current.src = iframeRef.current.src;
      }
    } catch (e) {
      console.error("[ThemeEditor] publish error:", e);
    } finally {
      setPublishing(false);
    }
  };

  // ── Rollback ───────────────────────────────────────────────────────────────
  const handleRollback = async (snapshotId: string) => {
    if (!storeId || rollingBack) return;
    setRollingBack(true);
    try {
      const updated = await rollbackStoreThemeSnapshot(storeId, snapshotId);
      setThemeState(updated);
      initSections(storeTemplate, updated);
      const snaps = await loadStoreThemeSnapshots(storeId);
      setSnapshots(snaps);
      setShowRollbackModal(false);
      if (iframeRef.current?.src) {
        iframeRef.current.src = iframeRef.current.src;
      }
    } catch (e) {
      console.error("[ThemeEditor] rollback error:", e);
    } finally {
      setRollingBack(false);
    }
  };

  // ── Inspector ──────────────────────────────────────────────────────────────
  const manifest = getStorefrontThemeByTemplate(storeTemplate);
  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? null;
  const inspectorFields =
    selectedSection && manifest
      ? (manifest.sectionSchema.find((s) => s.type === selectedSection.type)?.settings ?? [])
      : [];

  // ── Draft badge ────────────────────────────────────────────────────────────
  const hasUnpublishedDraft =
    themeState !== null &&
    (
      (themeState.draft_custom_css ?? "") !== (themeState.published_custom_css ?? "") ||
      JSON.stringify(themeState.draft_page_layout) !== JSON.stringify(themeState.published_page_layout)
    );

  // ── Loading / error guards ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="font-medium text-foreground">Could not load store data.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Please try refreshing the page.
          </p>
          <Button asChild className="mt-4" variant="outline" size="sm">
            <Link to="/admin/dashboard">← Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        {/* Panel toggle */}
        <button
          onClick={() => setLeftPanelOpen((p) => !p)}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          title={leftPanelOpen ? "Hide sections panel" : "Show sections panel"}
        >
          {leftPanelOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="h-4 w-px bg-border" />

        <Link
          to="/admin/dashboard"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Admin
        </Link>

        <div className="h-4 w-px bg-border" />
        <span className="text-sm font-semibold text-foreground">
          Theme Editor
        </span>

        {storeName && (
          <>
            <div className="h-4 w-px bg-border" />
            <span className="max-w-[140px] truncate text-sm text-muted-foreground">
              {storeName}
            </span>
          </>
        )}

        {themeState && (
          <Badge
            variant={hasUnpublishedDraft ? "secondary" : "default"}
            className="ml-1 gap-1 text-xs"
          >
            {hasUnpublishedDraft ? (
              <>
                <FileEdit className="h-3 w-3" />
                Draft
              </>
            ) : (
              <>
                <Globe className="h-3 w-3" />
                Live
              </>
            )}
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {previewWidth !== null && (
            <span className="tabular-nums text-xs text-muted-foreground">
              {previewWidth}px
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRollbackModal(true)}
            disabled={snapshots.length === 0}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            History
          </Button>
          <Button
            size="sm"
            onClick={() => setShowPublishDialog(true)}
            disabled={!storeId || publishing}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Publish
          </Button>
        </div>
      </header>

      {/* ── Body (panel + preview) ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sections panel */}
        {leftPanelOpen && (
          <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
            {/* Panel header */}
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Layers className="h-4 w-4 text-muted-foreground" />
                Sections
              </div>
              <div className="flex items-center gap-1.5">
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : savedAt ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="h-3 w-3" />
                    Saved
                  </span>
                ) : null}
              </div>
            </div>

            {/* Sections list */}
            <div className="flex-1 overflow-y-auto p-2">
              {sections.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  {storeTemplate
                    ? "No sections found for this theme."
                    : "Install a theme from the marketplace to manage sections."}
                </div>
              ) : (
                <Reorder.Group
                  axis="y"
                  values={sections}
                  onReorder={handleReorder}
                  className="space-y-1 list-none p-0 m-0"
                >
                  {sections.map((section) => (
                    <SectionRow
                      key={section.id}
                      section={section}
                      selected={selectedSectionId === section.id}
                      onSelect={handleSectionSelect}
                      onToggle={handleToggleVisible}
                      onDelete={handleDeleteSection}
                      onDragStart={() => setIsDraggingSections(true)}
                      onDragEnd={() => setIsDraggingSections(false)}
                    />
                  ))}
                </Reorder.Group>
              )}
            </div>

            {/* Add section button */}
            {manifest && (
              <div className="shrink-0 border-t border-border px-2 py-2">
                <button
                  onClick={() => setShowAddSectionModal(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add section
                </button>
              </div>
            )}

            {/* AI chat */}
            <div className="shrink-0 border-t border-border">
              {/* Chat label */}
              <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">AI Design</span>
              </div>

              {/* Chat thread (last 4 messages) */}
              {chatHistory.length > 0 && (
                <div
                  ref={chatScrollRef}
                  className="max-h-28 overflow-y-auto px-2 pb-1 space-y-1"
                >
                  {chatHistory.slice(-4).map((msg, i) => (
                    <div
                      key={i}
                      className={`rounded px-2 py-1 text-xs leading-snug ${
                        msg.role === "user"
                          ? "bg-primary/10 text-foreground ml-4"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {msg.text}
                    </div>
                  ))}
                  {aiThinking && (
                    <div className="flex items-center gap-1.5 rounded bg-muted px-2 py-1">
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Building…</span>
                    </div>
                  )}
                </div>
              )}

              {/* Input row */}
              <div className="flex items-center gap-1.5 p-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                  disabled={aiThinking}
                  placeholder="Describe a change…"
                  className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary disabled:opacity-50"
                />
                <button
                  onClick={handleChatSend}
                  disabled={aiThinking || !chatInput.trim()}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {aiThinking ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Preview area */}
        <div
          ref={containerRef}
          className="relative flex flex-1 items-stretch overflow-hidden bg-muted/20"
        >
          {/* Iframe wrapper — width driven by drag */}
          <div
            className="relative mx-auto h-full bg-background shadow-lg"
            style={{
              width: previewWidth !== null ? `${previewWidth}px` : "100%",
              maxWidth: "100%",
            }}
          >
            {storeUrl ? (
              <>
                <iframe
                  ref={iframeRef}
                  src={storeUrl}
                  className="h-full w-full border-0"
                  onLoad={handleIframeLoad}
                  title="Store Preview"
                />

                {/* Overlay: blocks iframe from stealing events during any drag */}
                {(isDraggingResize || isDraggingSections) && (
                  <div className="absolute inset-0 z-10 cursor-grabbing" />
                )}

                {/* Right-edge resize handle */}
                <div
                  onMouseDown={handleResizeMouseDown}
                  className="absolute right-0 top-0 z-20 flex h-full w-4 cursor-col-resize items-center justify-center transition-colors hover:bg-primary/10 active:bg-primary/20"
                  title="Drag to resize preview"
                >
                  <div className="pointer-events-none flex h-8 flex-col items-center justify-center gap-0.5">
                    <div className="h-3 w-0.5 rounded-full bg-muted-foreground/60" />
                    <div className="h-3 w-0.5 rounded-full bg-muted-foreground/60" />
                    <div className="h-3 w-0.5 rounded-full bg-muted-foreground/60" />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Store preview unavailable.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Inspector panel */}
        {selectedSection && (
          <ThemeEditorInspector
            sectionLabel={selectedSection.label}
            fields={inspectorFields}
            values={selectedSection.settings ?? {}}
            onChange={handleSectionSettingChange}
            onClose={() => setSelectedSectionId(null)}
          />
        )}
      </div>

      {/* ── Publish dialog ──────────────────────────────────────────────── */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish changes to your store?</DialogTitle>
            <DialogDescription>
              Your current draft will go live immediately. All visitors will see
              the updated design.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPublishDialog(false)}
              disabled={publishing}
            >
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {publishing ? "Publishing…" : "Publish Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Version history dialog ──────────────────────────────────────── */}
      <Dialog open={showRollbackModal} onOpenChange={setShowRollbackModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              Restore a previously published version of your store design.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
            {snapshots.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No published versions yet.
              </p>
            ) : (
              snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Version {snap.version}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {snap.created_at
                        ? new Date(snap.created_at).toLocaleString()
                        : "Date unknown"}
                    </p>
                    {snap.reason && snap.reason !== "publish" && (
                      <p className="text-xs capitalize text-muted-foreground">
                        {snap.reason}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={rollingBack}
                    onClick={() => handleRollback(snap.id)}
                  >
                    {rollingBack ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Restore"
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add section picker ──────────────────────────────────────────── */}
      <Dialog open={showAddSectionModal} onOpenChange={setShowAddSectionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add section</DialogTitle>
            <DialogDescription>
              Choose a section to add to your home page.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {manifest
              ? manifest.sectionSchema
                  .filter((s) => s.page === "home")
                  .map((schema) => {
                    const Icon: LucideIcon = SECTION_ICONS[schema.type] ?? Package;
                    const alreadyAdded = sections.some((s) => s.type === schema.type);
                    return (
                      <button
                        key={schema.type}
                        disabled={alreadyAdded}
                        onClick={() => handleAddSection(schema.type)}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                          alreadyAdded
                            ? "cursor-not-allowed border-border/40 bg-muted/20 opacity-50"
                            : "border-border bg-card hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0 rounded-md bg-muted p-1.5">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {schema.label}
                          </p>
                          {schema.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {schema.description}
                            </p>
                          )}
                        </div>
                        {alreadyAdded && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            Added
                          </span>
                        )}
                      </button>
                    );
                  })
              : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No theme installed.
                </p>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
