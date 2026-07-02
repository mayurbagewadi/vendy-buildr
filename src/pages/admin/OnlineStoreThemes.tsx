import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  getStorefrontThemeById,
  getStorefrontThemeByTemplate,
  STOREFRONT_THEME_MANIFESTS,
} from "@/new-storefront/theme-engine/registry";
import type { StorefrontThemeManifest, ThemeSettingField } from "@/new-storefront/theme-engine/types";
import {
  loadStoreThemeSnapshots,
  loadStoreThemeState,
  publishDraftThemeState,
  rollbackStoreThemeSnapshot,
  saveDraftThemeState,
  type StoreThemeSnapshot,
  type StoreThemeState,
} from "@/lib/storeThemeState";
import {
  CheckCircle2,
  Eye,
  LayoutTemplate,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Store,
  Upload,
} from "lucide-react";

interface StoreThemeRow {
  id: string;
  slug: string | null;
  name: string | null;
  storefront_template: string | null;
  storefront_theme: string | null;
  storefront_color_palette: string | null;
}

const CACHE_PREFIX = "dd_sf_";

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "Not published yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const settingsKey = (settings: Record<string, unknown>) => JSON.stringify(settings);

const mergeThemeSettings = (
  theme: StorefrontThemeManifest | null,
  overrides?: Record<string, unknown> | null
) => ({
  ...(theme?.defaultSettings ?? {}),
  ...(overrides ?? {}),
});

const fieldValue = (settings: Record<string, unknown>, field: ThemeSettingField) =>
  settings[field.id] ?? field.defaultValue ?? "";

const editableFieldTypes = new Set(["text", "textarea", "image", "select", "boolean", "number"]);

const OnlineStoreThemes = () => {
  const [store, setStore] = useState<StoreThemeRow | null>(null);
  const [themeState, setThemeState] = useState<StoreThemeState | null>(null);
  const [snapshots, setSnapshots] = useState<StoreThemeSnapshot[]>([]);
  const [draftSettings, setDraftSettings] = useState<Record<string, unknown>>({});
  const [savedDraftKey, setSavedDraftKey] = useState("{}");
  const [draftThemeId, setDraftThemeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPageData = async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: storeData, error: storeError } = await supabase
        .from("stores")
        .select("id, slug, name, storefront_template, storefront_theme, storefront_color_palette")
        .eq("user_id", user.id)
        .maybeSingle();

      if (storeError) throw storeError;
      setStore(storeData ?? null);

      if (!storeData?.id) return;

      const loadedThemeState = await loadStoreThemeState(storeData.id);
      setThemeState(loadedThemeState);

      const publishedTheme =
        getStorefrontThemeById(loadedThemeState?.published_theme_id) ??
        getStorefrontThemeByTemplate(storeData.storefront_template);
      const draftTheme =
        getStorefrontThemeById(loadedThemeState?.draft_theme_id) ??
        publishedTheme;

      const nextDraftThemeId = draftTheme?.id ?? publishedTheme?.id ?? null;
      const nextDraftSettings = mergeThemeSettings(draftTheme, loadedThemeState?.draft_settings);

      setDraftThemeId(nextDraftThemeId);
      setDraftSettings(nextDraftSettings);
      setSavedDraftKey(settingsKey(nextDraftSettings));
      setSnapshots(await loadStoreThemeSnapshots(storeData.id));
    } catch (error: any) {
      console.error("Failed to load online store theme state:", error);
      setLoadError(error.message || "Could not load theme state.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const publishedTheme = useMemo(
    () =>
      getStorefrontThemeById(themeState?.published_theme_id) ??
      getStorefrontThemeByTemplate(store?.storefront_template),
    [store?.storefront_template, themeState?.published_theme_id]
  );

  const draftTheme = useMemo(
    () => getStorefrontThemeById(draftThemeId) ?? publishedTheme,
    [draftThemeId, publishedTheme]
  );

  const hasCustomTheme = Boolean(publishedTheme);
  const hasUnsavedDraft = settingsKey(draftSettings) !== savedDraftKey;
  const previewPath = store?.slug ? `/${store.slug}` : "/";

  const bustStoreCache = () => {
    if (store?.slug) sessionStorage.removeItem(CACHE_PREFIX + store.slug);
  };

  const updateDraftSetting = (field: ThemeSettingField, value: unknown) => {
    setDraftSettings((current) => ({
      ...current,
      [field.id]: value,
    }));
  };

  const saveDraft = async () => {
    if (!store?.id || !draftTheme) return null;

    setIsSaving(true);
    try {
      const saved = await saveDraftThemeState({
        storeId: store.id,
        themeId: draftTheme.id,
        themeVersion: draftTheme.version,
        settings: draftSettings,
        pageLayout: themeState?.draft_page_layout ?? {},
      });

      setThemeState(saved);
      setSavedDraftKey(settingsKey(draftSettings));
      toast({ title: "Draft saved", description: "Theme changes are saved as draft only." });
      return saved;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: error.message || "Could not save draft settings.",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const publishDraft = async () => {
    if (!store?.id || !draftTheme) return;

    setIsPublishing(true);
    try {
      if (hasUnsavedDraft || !themeState) {
        const saved = await saveDraft();
        if (!saved) return;
      }

      const published = await publishDraftThemeState(store.id);
      setThemeState(published);
      setDraftThemeId(published.draft_theme_id);
      setDraftSettings(mergeThemeSettings(draftTheme, published.draft_settings));
      setSavedDraftKey(settingsKey(mergeThemeSettings(draftTheme, published.draft_settings)));
      setSnapshots(await loadStoreThemeSnapshots(store.id));
      bustStoreCache();
      toast({ title: "Published", description: "Live storefront now uses the published theme draft." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Publish failed",
        description: error.message || "Could not publish theme changes.",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const installThemeAsDraft = async (theme: StorefrontThemeManifest) => {
    if (!store?.id) return;

    const nextSettings = mergeThemeSettings(theme, {});
    setDraftThemeId(theme.id);
    setDraftSettings(nextSettings);
    setIsSaving(true);

    try {
      const saved = await saveDraftThemeState({
        storeId: store.id,
        themeId: theme.id,
        themeVersion: theme.version,
        settings: nextSettings,
        pageLayout: {},
      });

      setThemeState(saved);
      setSavedDraftKey(settingsKey(nextSettings));
      toast({ title: "Installed as draft", description: "Publish when you are ready to make it live." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Install failed",
        description: error.message || "Could not install theme as draft.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const rollbackSnapshot = async (snapshot: StoreThemeSnapshot) => {
    if (!store?.id || !draftTheme) return;

    setIsRollingBack(snapshot.id);
    try {
      const rolledBack = await rollbackStoreThemeSnapshot(store.id, snapshot.id);
      const rollbackTheme = getStorefrontThemeById(rolledBack.published_theme_id) ?? draftTheme;
      const nextSettings = mergeThemeSettings(rollbackTheme, rolledBack.draft_settings);

      setThemeState(rolledBack);
      setDraftThemeId(rolledBack.draft_theme_id);
      setDraftSettings(nextSettings);
      setSavedDraftKey(settingsKey(nextSettings));
      setSnapshots(await loadStoreThemeSnapshots(store.id));
      bustStoreCache();
      toast({ title: "Rollback published", description: `Restored version ${snapshot.version}.` });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Rollback failed",
        description: error.message || "Could not rollback theme.",
      });
    } finally {
      setIsRollingBack(null);
    }
  };

  const renderField = (field: ThemeSettingField) => {
    if (!editableFieldTypes.has(field.type)) return null;

    const value = fieldValue(draftSettings, field);
    const id = `theme-field-${field.id}`;

    return (
      <div key={field.id} className="space-y-2">
        <Label htmlFor={id}>{field.label}</Label>
        {field.type === "textarea" ? (
          <Textarea
            id={id}
            value={String(value)}
            onChange={(event) => updateDraftSetting(field, event.target.value)}
            placeholder={field.placeholder}
            rows={3}
          />
        ) : field.type === "select" ? (
          <select
            id={id}
            value={String(value)}
            onChange={(event) => updateDraftSetting(field, event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.type === "boolean" ? (
          <div className="flex h-10 items-center">
            <Switch
              id={id}
              checked={Boolean(value)}
              onCheckedChange={(checked) => updateDraftSetting(field, checked)}
            />
          </div>
        ) : (
          <Input
            id={id}
            type={field.type === "number" ? "number" : "text"}
            value={String(value)}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(event) =>
              updateDraftSetting(
                field,
                field.type === "number" ? Number(event.target.value) : event.target.value
              )
            }
            placeholder={field.placeholder}
          />
        )}
        {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm">Loading online store...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Store className="h-6 w-6 text-primary" />
          Online Store
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage storefront themes with draft, publish, and rollback.
        </p>
      </div>

      {loadError && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            {loadError}
          </CardContent>
        </Card>
      )}

      <Card className="admin-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            <div className="rounded-lg bg-primary/10 p-2">
              <LayoutTemplate className="h-4 w-4 text-primary" />
            </div>
            Current Theme
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {publishedTheme?.manifest.name ?? "Default Store Theme"}
                </h2>
                <Badge variant={hasCustomTheme ? "default" : "secondary"}>
                  {hasCustomTheme ? "Runtime theme" : "Basic theme"}
                </Badge>
                {publishedTheme?.version && <Badge variant="outline">v{publishedTheme.version}</Badge>}
                {themeState?.version != null && <Badge variant="outline">publish #{themeState.version}</Badge>}
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {publishedTheme?.manifest.description ??
                  "Default theme and color palette are still managed from Settings -> Theme."}
              </p>
              <p className="text-xs text-muted-foreground">
                Last published: {formatDateTime(themeState?.published_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link to={previewPath}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Live
                </Link>
              </Button>
              <Button onClick={saveDraft} disabled={!draftTheme || isSaving || !hasUnsavedDraft}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Draft
              </Button>
              <Button onClick={publishDraft} disabled={!draftTheme || isPublishing}>
                {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Publish
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Draft safe
              </div>
              <p className="text-sm text-muted-foreground">
                Saving changes updates draft settings only. Live storefront changes after publish.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Palette className="h-4 w-4 text-primary" />
                Structured settings
              </div>
              <p className="text-sm text-muted-foreground">
                Merchants edit schema fields, not raw HTML, CSS, or JavaScript.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <RotateCcw className="h-4 w-4 text-primary" />
                Rollback ready
              </div>
              <p className="text-sm text-muted-foreground">
                Every publish creates a snapshot row for restore.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {draftTheme && (
        <Card className="admin-card">
          <CardHeader>
            <CardTitle className="text-base">Customize Draft</CardTitle>
            <p className="text-sm text-muted-foreground">
              Editing {draftTheme.manifest.name}. These changes are not live until publish.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {(draftTheme.configSchema.groups ?? []).map((group) => (
              <div key={group.id} className="space-y-4 rounded-lg border p-4">
                <h3 className="font-medium">{group.label}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {group.fields
                    .map((fieldId) => draftTheme.configSchema.fields.find((field) => field.id === fieldId))
                    .filter(Boolean)
                    .map((field) => renderField(field as ThemeSettingField))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="admin-card">
        <CardHeader>
          <CardTitle className="text-base">Theme Library</CardTitle>
          <p className="text-sm text-muted-foreground">
            Install themes as draft first. Publishing is a separate action.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {STOREFRONT_THEME_MANIFESTS.map((theme) => (
              <div key={theme.id} className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{theme.manifest.name}</h3>
                    <p className="text-xs text-muted-foreground">v{theme.version}</p>
                  </div>
                  <Badge variant={theme.id === publishedTheme?.id ? "default" : "outline"}>
                    {theme.id === publishedTheme?.id ? "Live" : theme.id === draftTheme?.id ? "Draft" : "Available"}
                  </Badge>
                </div>
                <p className="min-h-12 text-sm text-muted-foreground">{theme.manifest.description}</p>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSaving || theme.id === draftTheme?.id}
                    onClick={() => installThemeAsDraft(theme)}
                  >
                    Install as Draft
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {snapshots.length > 0 && (
        <Card className="admin-card">
          <CardHeader>
            <CardTitle className="text-base">Rollback Snapshots</CardTitle>
            <p className="text-sm text-muted-foreground">
              Last 10 published versions for this store.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Version {snapshot.version}</span>
                    <Badge variant="outline">{snapshot.reason}</Badge>
                    <span className="text-xs text-muted-foreground">{snapshot.theme_id}@{snapshot.theme_version ?? "unknown"}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(snapshot.created_at)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(isRollingBack)}
                  onClick={() => rollbackSnapshot(snapshot)}
                >
                  {isRollingBack === snapshot.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  )}
                  Rollback
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OnlineStoreThemes;
