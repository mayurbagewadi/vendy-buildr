/**
 * Compact store frontend template sent to AI as context.
 * Captures all sections, Tailwind classes, CSS variables, and layout hooks.
 * Excludes: icon imports, font imports, data-fetching logic.
 * Update this whenever Store.tsx structure changes significantly.
 */
export const STORE_TEMPLATE = `
// ===== STORE FRONTEND STRUCTURE =====
// Framework: React + Tailwind CSS + CSS custom properties (HSL)

// === CORE CSS VARIABLES ===
// --primary, --primary-foreground, --background, --foreground
// --card, --card-foreground, --muted, --muted-foreground
// --border, --radius, --accent, --accent-foreground
// --secondary, --secondary-foreground, --ring

// === ADVANCED CSS VARIABLES (NEW) ===
// --primary-hover          → button hover state
// --shadow-card            → default card shadow (e.g. "0 2px 8px rgba(0,0,0,0.08)")
// --shadow-elevated        → floating element shadow
// --transition-base        → base transition speed (e.g. "0.2s")
// --transition-smooth      → smooth animation speed (e.g. "0.4s")
// --font-heading           → heading font family (e.g. "Poppins, sans-serif")
// --font-body              → body text font family (e.g. "Inter, sans-serif")
// --heading-weight         → heading font weight (e.g. "700")
// --heading-letter-spacing → heading letter spacing (e.g. "-0.02em")
// --body-line-height       → body line height (e.g. "1.6")

// === COMPONENT VARIANTS ===
// button_style: "rounded" | "sharp" | "pill" | "soft"
//   rounded (default) → border-radius: var(--radius)
//   sharp             → border-radius: 0
//   pill              → border-radius: 9999px
//   soft              → border-radius: 12px, subtle shadow
//
// card_style: "default" | "flat" | "elevated" | "bordered" | "glass"
//   default   → bg-card border border-border rounded-[--radius]
//   flat      → bg-card no border no shadow
//   elevated  → bg-card shadow-lg no border
//   bordered  → bg-card border-2 border-primary/20
//   glass     → bg-card/50 backdrop-blur-md border border-white/10
//
// header_style: "solid" | "transparent" | "gradient" | "glass"
//   solid (default)  → bg-background border-b
//   transparent      → bg-transparent (overlays hero)
//   gradient         → gradient background
//   glass            → backdrop-blur with transparency

// === AI-CONTROLLED LAYOUT VARIABLES ===
// product_grid_cols: "2" | "3" | "4"
// section_padding: "compact" | "normal" | "spacious"
// hero_style: "image" | "gradient" | "split" | "minimal"
// section_gap: "tight" | "normal" | "loose"

// === TYPOGRAPHY SYSTEM ===
// google_font → name of Google Font to load (e.g. "Playfair Display")
// google_font_body → body font (e.g. "Source Sans Pro")
// Injected as <link> tag for Google Fonts CDN

// === SECTION 1: HEADER ===
// data-ai="header"
// Classes: bg-background border-b border-border sticky top-0 z-50
// Contains: logo, store name, nav links, cart icon, search

// === SECTION 2: HERO BANNER ===
// data-ai="section-hero"
// Classes: relative w-full overflow-hidden
// hero_style: "image" | "gradient" | "split" | "minimal"

// === SECTION 3: CATEGORIES ===
// data-ai="section-categories"
// Title: "Shop by Category"
// Layout: horizontal scroll with category cards

// === SECTION 4: FEATURED PRODUCTS ===
// data-ai="section-featured"
// Grid: controlled by product_grid_cols
// Component: ProductCard with hover animations

// === SECTION 5: INSTAGRAM REELS ===
// Condition: store has Instagram enabled

// === SECTION 6: GOOGLE REVIEWS ===
// data-ai="section-reviews"
// Review cards with star ratings

// === SECTION 7: NEW ARRIVALS ===
// Same grid as featured products

// === SECTION 8: CTA BANNER ===
// data-ai="section-cta"
// Full-width banner with action buttons

// === SECTION 9: FOOTER ===
// data-ai="section-footer"
// Store info, links, social media

// ===== CSS VARIABLES REFERENCE =====
// :root {
//   --primary: 217 91% 60%;
//   --primary-foreground: 0 0% 100%;
//   --background: 0 0% 100%;
//   --foreground: 222 47% 11%;
//   --card: 0 0% 100%;
//   --card-foreground: 222 47% 11%;
//   --muted: 210 40% 96%;
//   --muted-foreground: 215 16% 47%;
//   --border: 214 32% 91%;
//   --radius: 0.5rem;
// }

// ===== WHAT AI CAN CHANGE =====
// 1. css_variables → any :root CSS variable (15+ core + advanced)
// 2. dark_css_variables → .dark mode overrides
// 3. layout.product_grid_cols → "2" | "3" | "4"
// 4. layout.section_padding → "compact" | "normal" | "spacious"
// 5. layout.hero_style → "image" | "gradient" | "split" | "minimal"
// 6. layout.button_style → "rounded" | "sharp" | "pill" | "soft"
// 7. layout.card_style → "default" | "flat" | "elevated" | "bordered" | "glass"
// 8. layout.header_style → "solid" | "transparent" | "gradient" | "glass"
// 9. layout.section_gap → "tight" | "normal" | "loose"
// 10. fonts.heading → Google Font name for headings
// 11. fonts.body → Google Font name for body text
// 12. css_overrides → raw CSS rules targeting any element
`;
