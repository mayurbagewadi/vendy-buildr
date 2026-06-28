import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  getStorefrontThemeByTemplate,
  STOREFRONT_THEME_MANIFESTS,
} from "@/new-storefront/theme-engine/registry";
import {
  CheckCircle2,
  Eye,
  LayoutTemplate,
  Loader2,
  Palette,
  Store,
  Wand2,
} from "lucide-react";

interface StoreThemeRow {
  id: string;
  slug: string | null;
  name: string | null;
  storefront_template: string | null;
  storefront_theme: string | null;
  storefront_color_palette: string | null;
}

const OnlineStoreThemes = () => {
  const [store, setStore] = useState<StoreThemeRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStore = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("stores")
        .select("id, slug, name, storefront_template, storefront_theme, storefront_color_palette")
        .eq("user_id", user.id)
        .maybeSingle();

      setStore(data ?? null);
      setIsLoading(false);
    };

    loadStore();
  }, []);

  const activeTheme = useMemo(
    () => getStorefrontThemeByTemplate(store?.storefront_template),
    [store?.storefront_template]
  );
  const isCustomTheme = Boolean(activeTheme);
  const previewPath = store?.slug ? `/${store.slug}` : "/";

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
          Manage storefront themes separately from basic store settings.
        </p>
      </div>

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
                  {activeTheme?.manifest.name ?? "Default Store Theme"}
                </h2>
                <Badge variant={isCustomTheme ? "default" : "secondary"}>
                  {isCustomTheme ? "Custom theme" : "Basic theme"}
                </Badge>
                {activeTheme?.version && <Badge variant="outline">v{activeTheme.version}</Badge>}
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {activeTheme?.manifest.description ??
                  "Default theme and color palette are still managed from Settings -> Theme."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link to={previewPath}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Link>
              </Button>
              <Button disabled>
                <Wand2 className="mr-2 h-4 w-4" />
                Customize
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Installed
              </div>
              <p className="text-sm text-muted-foreground">
                Custom themes will be installed here first. Install should not change the live store.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Palette className="h-4 w-4 text-primary" />
                Customize
              </div>
              <p className="text-sm text-muted-foreground">
                Future editor will control schema-backed content, sections, colors, and layout.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Store className="h-4 w-4 text-primary" />
                Publish
              </div>
              <p className="text-sm text-muted-foreground">
                Future custom theme changes should use draft, preview, publish, and rollback.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="admin-card">
        <CardHeader>
          <CardTitle className="text-base">Theme Library</CardTitle>
          <p className="text-sm text-muted-foreground">
            Available runtime themes registered for the new storefront.
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
                  <Badge variant={theme.template === store?.storefront_template ? "default" : "outline"}>
                    {theme.template === store?.storefront_template ? "Active" : "Available"}
                  </Badge>
                </div>
                <p className="min-h-12 text-sm text-muted-foreground">{theme.manifest.description}</p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" disabled>
                    Install as Draft
                  </Button>
                  <Button size="sm" variant="ghost" disabled>
                    Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnlineStoreThemes;
