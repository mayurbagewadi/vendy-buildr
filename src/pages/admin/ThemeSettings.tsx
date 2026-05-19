import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Palette, Sun, Moon, Monitor } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { COLOR_PALETTES, type PaletteId } from "@/lib/colorPalettes";

type ThemeOption = "dark" | "light" | "system";

const THEME_OPTIONS: { value: ThemeOption; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "dark",   label: "Dark",   icon: <Moon className="w-5 h-5" />,    desc: "Dark background, light text" },
  { value: "light",  label: "Light",  icon: <Sun className="w-5 h-5" />,     desc: "Light background, dark text" },
  { value: "system", label: "System", icon: <Monitor className="w-5 h-5" />, desc: "Follows visitor's OS setting" },
];

const ThemeSettings = () => {
  const [whatsappFloatEnabled, setWhatsappFloatEnabled] = useState(true);
  const [storefrontTheme, setStorefrontTheme] = useState<ThemeOption>("dark");
  const [storefrontPalette, setStorefrontPalette] = useState<PaletteId>("default");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: store } = await supabase
        .from("stores")
        .select("id, whatsapp_float_enabled, storefront_theme, storefront_color_palette")
        .eq("user_id", user.id)
        .single();

      if (store) {
        setStoreId(store.id);
        setWhatsappFloatEnabled(store.whatsapp_float_enabled !== false);
        setStorefrontTheme((store.storefront_theme as ThemeOption) || "dark");
        setStorefrontPalette((store.storefront_color_palette as PaletteId) || "default");
      }
    };
    loadSettings();
  }, []);

  const handleWhatsappToggle = async (checked: boolean) => {
    setWhatsappFloatEnabled(checked);
    if (!storeId) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("stores")
      .update({ whatsapp_float_enabled: checked })
      .eq("id", storeId);
    setIsSaving(false);

    if (error) {
      setWhatsappFloatEnabled(!checked);
      toast({ variant: "destructive", title: "Save Failed", description: "Could not update setting. Please try again." });
    } else {
      toast({ title: "Saved", description: `WhatsApp button ${checked ? "enabled" : "disabled"}.` });
    }
  };

  const handlePaletteChange = async (value: PaletteId) => {
    if (!storeId) return;
    const previous = storefrontPalette;
    setStorefrontPalette(value);

    const { error } = await supabase
      .from("stores")
      .update({ storefront_color_palette: value })
      .eq("id", storeId);

    if (error) {
      setStorefrontPalette(previous);
      toast({ variant: "destructive", title: "Save Failed", description: "Could not update color palette. Please try again." });
    } else {
      const label = COLOR_PALETTES.find(p => p.id === value)?.label ?? value;
      toast({ title: "Saved", description: `Color palette set to ${label}.` });
    }
  };

  const handleThemeChange = async (value: ThemeOption) => {
    if (!storeId) return;
    const previous = storefrontTheme;
    setStorefrontTheme(value);

    const { error } = await supabase
      .from("stores")
      .update({ storefront_theme: value })
      .eq("id", storeId);

    if (error) {
      setStorefrontTheme(previous);
      toast({ variant: "destructive", title: "Save Failed", description: "Could not update theme. Please try again." });
    } else {
      toast({ title: "Saved", description: `Store theme set to ${value}.` });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Palette className="w-6 h-6 text-primary" />
          Theme
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Customize the appearance of your store</p>
      </div>

      {/* Storefront Theme */}
      <Card className="admin-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palette className="w-4 h-4 text-primary" />
            </div>
            Store Theme
          </CardTitle>
          <p className="text-sm text-muted-foreground">Choose the default theme for your customer-facing store</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {THEME_OPTIONS.map(({ value, label, icon, desc }) => {
              const isSelected = storefrontTheme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleThemeChange(value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer
                    ${isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                >
                  <div className={`p-2 rounded-lg ${isSelected ? "bg-primary/20" : "bg-muted"}`}>
                    {icon}
                  </div>
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs text-center leading-tight opacity-70">{desc}</span>
                  {isSelected && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Color Palette */}
      <Card className="admin-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palette className="w-4 h-4 text-primary" />
            </div>
            Color Palette
          </CardTitle>
          <p className="text-sm text-muted-foreground">Choose a color scheme for your customer-facing store</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {COLOR_PALETTES.map(({ id, label, swatches }) => {
              const isSelected = storefrontPalette === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handlePaletteChange(id as PaletteId)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer
                    ${isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                >
                  <div className="flex gap-1.5">
                    {swatches.map((color, i) => (
                      <span
                        key={i}
                        className="w-4 h-4 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-semibold">{label}</span>
                  {isSelected && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Button Visibility */}
      <Card className="admin-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            <svg viewBox="0 0 455.731 455.731" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 rounded-full flex-shrink-0" aria-hidden="true">
              <circle cx="227.866" cy="227.866" r="227.866" fill="#1BD741"/>
              <path fill="#FFFFFF" d="M68.494,387.41l22.323-79.284c-14.355-24.387-21.913-52.134-21.913-80.638c0-87.765,71.402-159.167,159.167-159.167s159.166,71.402,159.166,159.167c0,87.765-71.401,159.167-159.166,159.167c-27.347,0-54.125-7-77.814-20.292L68.494,387.41z M154.437,337.406l4.872,2.975c20.654,12.609,44.432,19.274,68.762,19.274c72.877,0,132.166-59.29,132.166-132.167S300.948,95.321,228.071,95.321S95.904,154.611,95.904,227.488c0,25.393,7.217,50.052,20.869,71.311l3.281,5.109l-12.855,45.658L154.437,337.406z"/>
              <path fill="#FFFFFF" d="M183.359,153.407l-10.328-0.563c-3.244-0.177-6.426,0.907-8.878,3.037c-5.007,4.348-13.013,12.754-15.472,23.708c-3.667,16.333,2,36.333,16.667,56.333c14.667,20,42,52,90.333,65.667c15.575,4.404,27.827,1.435,37.28-4.612c7.487-4.789,12.648-12.476,14.508-21.166l1.649-7.702c0.524-2.448-0.719-4.932-2.993-5.98l-34.905-16.089c-2.266-1.044-4.953-0.384-6.477,1.591l-13.703,17.764c-1.035,1.342-2.807,1.874-4.407,1.312c-9.384-3.298-40.818-16.463-58.066-49.687c-0.748-1.441-0.562-3.19,0.499-4.419l13.096-15.15c1.338-1.547,1.676-3.722,0.872-5.602l-15.046-35.201C187.187,154.774,185.392,153.518,183.359,153.407z"/>
            </svg>
            WhatsApp Button
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="whatsappFloatEnabled" className="text-base font-medium cursor-pointer">
                  Show WhatsApp Button on Store
                </Label>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${whatsappFloatEnabled ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                  {whatsappFloatEnabled ? "Visible" : "Hidden"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {whatsappFloatEnabled
                  ? "WhatsApp floating button is shown on your store homepage"
                  : "WhatsApp floating button is hidden from your store homepage"}
              </p>
            </div>
            <Switch
              id="whatsappFloatEnabled"
              checked={whatsappFloatEnabled}
              onCheckedChange={handleWhatsappToggle}
              disabled={isSaving}
              className={`ml-4 ${whatsappFloatEnabled ? "data-[state=checked]:bg-green-500" : ""}`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ThemeSettings;
