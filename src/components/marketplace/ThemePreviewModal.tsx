import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getStorefrontThemeBySlug } from "@/new-storefront/theme-engine/registry";
import type { ThemePreset } from "@/lib/themeRegistry";

type ThemePreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: {
    name: string;
    slug: string;
    description: string;
    theme_preset?: ThemePreset;
    theme_version?: string;
  };
  onInstall: () => void;
  installing?: boolean;
};

export function ThemePreviewModal({
  open,
  onOpenChange,
  theme,
  onInstall,
  installing = false,
}: ThemePreviewModalProps) {
  const activeTheme = getStorefrontThemeBySlug(theme.slug);
  const Preview = activeTheme?.components.Preview;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{theme.name} Preview</DialogTitle>
          <DialogDescription>{theme.description}</DialogDescription>
        </DialogHeader>

        {Preview ? (
          <Preview
            theme={theme}
            onInstall={onInstall}
            onClose={() => onOpenChange(false)}
            installing={installing}
          />
        ) : (
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Preview is not available for this theme yet.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={onInstall} disabled={installing}>
                {installing ? "Applying..." : "Install Theme"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
