/**
 * Compact store frontend template sent to AI as context.
 * Captures all sections, Tailwind classes, CSS variables, and layout hooks.
 * Excludes: icon imports, font imports, data-fetching logic.
 * Update this whenever Store.tsx structure changes significantly.
 */
export const STORE_TEMPLATE = `
// ===== STORE FRONTEND STRUCTURE =====
// Framework: React + Tailwind CSS + CSS custom properties (HSL)
// CSS variables used: --primary, --background, --foreground, --card, --muted, --muted-foreground, --border, --radius

// === AI-CONTROLLED LAYOUT VARIABLES ===
// gridColsClass → product_grid_cols: "2" | "3" | "4"
//   "2" → "grid grid-cols-2 sm:grid-cols-2 gap-6"
//   "3" → "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-6"
//   "4" (default) → "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6"
//
// sectionPy → section_padding: "compact" | "normal" | "spacious"
//   compact → "py-8", spacious → "py-24", normal (default) → "py-16"
//
// sectionPyLarge → same setting
//   compact → "py-10", spacious → "py-28", normal (default) → "py-20"

// === SECTION 1: HEADER ===
// Component: <Header storeSlug storeId />
// Classes: bg-background border-b border-border sticky top-0 z-50
// Contains: logo, store name, nav links, cart icon, search

// === SECTION 2: HERO BANNER ===
// Component: <HeroBannerCarousel bannerUrls storeName logoUrl storeDescription />
// Classes: relative w-full overflow-hidden (carousel slides)
// hero_style: "image" (default) | "gradient"
// Gradient option applies: bg-gradient-to-br from-primary/20 via-background to-muted

// === SECTION 3: CATEGORIES ===
// Condition: categories.length > 0
// Section classes: \`\${sectionPyLarge} bg-gradient-to-b from-muted/30 to-background relative overflow-hidden\`
// Title: "Shop by Category" → text-4xl md:text-5xl font-bold text-foreground mb-4
// Subtitle: text-lg text-muted-foreground max-w-2xl mx-auto
// Layout: horizontal scroll → flex gap-2 overflow-x-auto py-4 scrollbar-hide snap-x snap-mandatory
// Each category card: flex-shrink-0 w-48 snap-center
// Component: <CategoryCard name image_url productCount slug />
//   Card classes: bg-card border border-border rounded-[--radius] overflow-hidden hover:shadow-lg

// === SECTION 4: FEATURED PRODUCTS ===
// Section classes: \`\${sectionPy} bg-background\`
// Header: flex justify-between items-center mb-8
// Title: text-3xl font-bold text-foreground mb-2 → "Featured Products"
// Subtitle: text-muted-foreground → "Check out our top picks for you"
// CTA button: <Button variant="outline">See All</Button>
// Grid: \`\${gridColsClass}\` (AI-controlled columns)
// Component: <ProductCard id slug name category priceRange images status storeSlug />
//   Card classes: bg-card border border-border rounded-[--radius] overflow-hidden
//   Image: aspect-square object-cover w-full
//   Hover: whileHover={{ y: -8, scale: 1.05 }} (Framer Motion)
//   Price: text-primary font-bold
//   Category badge: bg-muted text-muted-foreground text-xs rounded-full px-2 py-1

// === SECTION 5: INSTAGRAM REELS ===
// Condition: store.instagram_reels_settings?.enabled && show_on_homepage
// Component: <InstagramReels storeId settings instagramUsername />
// Classes: py-16 bg-background (default section)

// === SECTION 6: GOOGLE REVIEWS ===
// Section classes: \`\${sectionPy} bg-muted/30\`
// Component: <GoogleReviewsSection storeId autoPlay />
// Review cards: bg-card border border-border rounded-[--radius] p-4
// Stars: text-primary (star color follows --primary)

// === SECTION 7: NEW ARRIVALS ===
// Condition: newArrivals.length > 0
// Section classes: \`\${sectionPy}\` (no bg, inherits background)
// Title: text-3xl font-bold text-foreground mb-2 → "New Arrivals"
// Subtitle: text-muted-foreground → "Fresh products just for you"
// Grid: \`\${gridColsClass}\` (same AI-controlled grid as featured)

// === SECTION 8: CTA BANNER ===
// Section classes: py-20 bg-primary text-primary-foreground mb-0
// Title: text-3xl md:text-4xl font-bold mb-4 → "Ready to Start Shopping?"
// Subtitle: text-xl mb-8 opacity-90
// Buttons: <Button size="lg" variant="secondary">Browse All Products</Button>
//          <Button size="lg" variant="secondary" className="bg-background text-foreground hover:bg-background/90">Contact on WhatsApp</Button>

// === SECTION 9: FOOTER ===
// Component: <StoreFooter storeName storeDescription whatsappNumber phone email address socialLinks policies />
// Classes: bg-card border-t border-border py-12
// Links: text-muted-foreground hover:text-foreground
// Bottom bar: bg-muted/50 py-4 text-center text-sm text-muted-foreground

// ===== CSS VARIABLES REFERENCE =====
// :root {
//   --primary: 217 91% 60%;        /* blue buttons, links, accents */
//   --primary-foreground: 0 0% 100%;
//   --background: 0 0% 100%;       /* page background */
//   --foreground: 222 47% 11%;     /* main text */
//   --card: 0 0% 100%;             /* card backgrounds */
//   --card-foreground: 222 47% 11%;
//   --muted: 210 40% 96%;          /* subtle sections, tags */
//   --muted-foreground: 215 16% 47%;
//   --border: 214 32% 91%;         /* borders */
//   --radius: 0.5rem;              /* border radius */
// }
// .dark {
//   --background: 222 47% 11%;
//   --foreground: 210 40% 98%;
//   --card: 222 47% 15%;
//   --muted: 217 33% 17%;
//   --border: 217 33% 25%;
// }

// ===== WHAT AI CAN CHANGE =====
// 1. css_variables → any :root CSS variable listed above
// 2. dark_css_variables → .dark mode overrides
// 3. layout.product_grid_cols → "2" | "3" | "4"
// 4. layout.section_padding → "compact" | "normal" | "spacious"
// 5. layout.hero_style → "image" | "gradient"
// 6. css_overrides → raw CSS rules targeting any element/class in the store
//    Example: ".product-card { box-shadow: 0 4px 24px hsl(var(--primary)/0.15); }"
//    Example: "h2 { letter-spacing: -0.02em; }"
//    Example: ".btn { border-radius: 9999px !important; }"
//    Example: "section { transition: background 0.3s; }"
`;
