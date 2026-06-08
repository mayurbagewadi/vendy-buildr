import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ThemePreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: {
    name: string;
    description: string;
    theme_preset?: {
      heroTitle: string;
      heroDescription: string;
      palette: string;
      theme: string;
    };
    theme_version?: string;
  };
  onInstall: () => void;
  installing?: boolean;
};

const previewCards = [
  {
    title: "Lavender Lavender-Oat Restorative Bar",
    price: "Rs. 14.00",
    badge: "floral note",
    image: "/themes/ecosoap/lavender_oatmeal_soap.png",
    skin: "Sensitive Skin",
    rating: "4.9",
  },
  {
    title: "Citrus Calendula Radiance Bar",
    price: "Rs. 15.00",
    badge: "citrus note",
    image: "/themes/ecosoap/citrus_calendula_soap.png",
    skin: "Normal Skin",
    rating: "4.8",
  },
  {
    title: "Activated Charcoal & Mint Detox Bar",
    price: "Rs. 16.00",
    badge: "earthy note",
    image: "/themes/ecosoap/activated_charcoal_soap.png",
    skin: "Oily Skin",
    rating: "5.0",
  },
];

export function ThemePreviewModal({
  open,
  onOpenChange,
  theme,
  onInstall,
  installing = false,
}: ThemePreviewModalProps) {
  const preset = theme.theme_preset;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{theme.name} Preview</DialogTitle>
          <DialogDescription>{theme.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="overflow-hidden rounded-2xl border border-stone-100 bg-white text-stone-900 shadow-sm">
            <div className="flex h-16 items-center justify-between border-b border-stone-100 bg-white/95 px-5">
              <div className="flex items-center gap-2.5">
                <div className="rounded-full bg-emerald-50 p-2 text-emerald-700">
                  <span className="block h-4 w-4 rounded-full border-2 border-emerald-700" />
                </div>
                <div>
                  <p className="font-serif text-lg font-semibold tracking-normal text-stone-900">EcoSoap</p>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-emerald-800">Handcrafted Organic</p>
                </div>
              </div>
              <div className="hidden gap-2 text-xs font-medium text-stone-600 md:flex">
                <span className="rounded-full bg-stone-100 px-3 py-1.5 text-stone-900">Shop Botanicals</span>
                <span className="rounded-full px-3 py-1.5">Soap Lab</span>
                <span className="rounded-full px-3 py-1.5">AI Skin Guide</span>
              </div>
            </div>

            <div className="bg-gradient-to-b from-stone-50 via-white to-stone-50/20 px-6 py-8">
              <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
                <div className="space-y-4 text-left lg:col-span-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-emerald-900">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Cold-Processed & Cured for 6 Weeks</span>
                  </div>
                  <h3 className="font-serif text-3xl font-medium leading-tight text-stone-900 md:text-4xl">
                    {preset?.heroTitle || "Nourish Your Barrier, Purely From Earth."}
                  </h3>
                  <p className="max-w-xl text-sm leading-relaxed text-stone-600">
                    {preset?.heroDescription || "A premium botanical storefront with editorial spacing, soap catalog discovery, and EcoSoap product storytelling."}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="rounded-full bg-stone-900 px-4 py-2 text-xs font-medium text-white">Explore Soap Catalog</span>
                    <span className="rounded-full border border-stone-200 px-4 py-2 text-xs font-medium text-stone-800">Launch Virtual Soap Lab</span>
                  </div>
                </div>

                <div className="relative lg:col-span-6">
                  <div className="aspect-[4/3] rotate-1 overflow-hidden rounded-2xl border-4 border-white shadow-2xl">
                    <img src="/themes/ecosoap/hero_soap_banner.png" alt="EcoSoap preview" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-stone-900/60 via-transparent to-transparent p-5 text-white">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-emerald-200">Featured Batch</p>
                        <p className="font-serif text-base font-medium">French Lavender & Oatmeal Meadow</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-stone-100 bg-white p-6">
              <div className="mx-auto mb-6 max-w-xl text-center">
                <h4 className="font-serif text-2xl font-semibold text-stone-900">Handcrafted Scent Collections</h4>
                <p className="mt-2 text-xs leading-relaxed text-stone-500">
                  Same catalog structure, product card treatment, and botanical theme assets used after install.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {previewCards.map((card) => (
                  <div key={card.title} className="overflow-hidden rounded-2xl border border-stone-100 bg-white text-left shadow-sm">
                    <div className="relative aspect-[4/3] overflow-hidden bg-stone-50">
                      <img src={card.image} alt={card.title} className="h-full w-full object-cover" />
                      <span className="absolute left-3 top-3 rounded-full border border-stone-100 bg-white/95 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-stone-800">
                        {card.badge}
                      </span>
                      <span className="absolute right-3 top-3 rounded-full bg-stone-900/80 px-2 py-1 text-[9px] font-bold text-white">
                        {card.rating}
                      </span>
                    </div>
                    <div className="p-4">
                      <span className="rounded-md border border-stone-100 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                        {card.skin}
                      </span>
                      <h5 className="mt-2 line-clamp-2 font-serif text-sm font-medium text-stone-900">{card.title}</h5>
                      <div className="mt-4 flex items-end justify-between border-t border-stone-50 pt-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Price</p>
                          <p className="font-serif text-base font-semibold text-stone-950">{card.price}</p>
                        </div>
                        <span className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-800">
                          Add Bar
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 border-t border-stone-100 pt-5 text-left md:grid-cols-3">
                {["100% Vegan & Cruelty-Free", "Rainforest Alliance Palm Oil", "Sustainably Sourced Wood Trays"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-stone-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-stone-100 bg-white px-6 py-8 text-left text-stone-600">
              <div className="grid gap-6 md:grid-cols-4">
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-emerald-50 p-1.5 text-emerald-700">
                      <span className="block h-3 w-3 rounded-full border-2 border-emerald-700" />
                    </div>
                    <span className="font-serif text-lg font-bold text-stone-900">EcoSoap</span>
                  </div>
                  <p className="max-w-sm text-xs leading-relaxed text-stone-500">
                    Dedicated to raw cold process saponification and native botanical skincare, with plastic-free packaging and premium catalog presentation.
                  </p>
                </div>
                <div className="space-y-2">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-stone-900">The Saponary</h5>
                  <div className="space-y-1 text-xs text-stone-500">
                    <p>Artisanal Shop</p>
                    <p>Experimental Soap Lab</p>
                    <p>AI Botanical Assessment</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-stone-900">Green Assurances</h5>
                  <div className="space-y-1 text-xs text-stone-500">
                    <p>100% Vegan & Cruelty-Free</p>
                    <p>Zero Plastic Dispatch</p>
                    <p>Seed-Paper Wrappers</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-col justify-between border-t border-stone-100 pt-5 text-xs text-stone-400 sm:flex-row">
                <p>(c) {new Date().getFullYear()} EcoSoap Studio. All Rights Reserved.</p>
                <div className="mt-2 flex gap-4 sm:mt-0">
                  <span>Privacy Charter</span>
                  <span>Zero Waste Vow</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-2 lg:self-start">
            <div className="space-y-4 rounded-2xl border bg-card p-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Preview matches installed theme</p>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li>EcoSoap header, hero, and product card structure</li>
                  <li>Reference images from public theme assets</li>
                  <li>Shared backend mapping after install</li>
                  <li>Default storefront remains unchanged</li>
                </ul>
              </div>

              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Preset</p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline">{preset?.theme || "dark"}</Badge>
                  <Badge variant="outline">{preset?.palette || "forest"}</Badge>
                  {theme.theme_version && <Badge variant="outline">v{theme.theme_version}</Badge>}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button className="flex-1" onClick={onInstall} disabled={installing}>
                  {installing ? "Applying..." : "Install Theme"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
