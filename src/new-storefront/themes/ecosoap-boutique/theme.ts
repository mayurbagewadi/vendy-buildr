import type {
  MarketplaceThemeDefinition,
} from "@/lib/themeRegistry";
import type {
  ThemeBlockSchema,
  ThemeSectionSchema,
  ThemeSettingsSchema,
} from "@/new-storefront/theme-engine/types";

export const ecosoapBoutiqueTheme = {
  id: "ecosoap-boutique",
  slug: "ecosoap-boutique",
  name: "EcoSoap Boutique",
  description:
    "A calm botanical storefront theme with editorial spacing, premium product cards, and conversion-focused visual hierarchy.",
  icon: "Palette",
  version: "1.0.0",
  template: "ecosoap-boutique",
  legacyTemplates: ["playful"],
  isFree: true,
  price: 0,
  preset: {
    theme: "dark",
    palette: "forest",
    heroTitle: "Nourish Your Barrier, Purely From Earth.",
    heroDescription:
      "A premium, editorial-style storefront built for artisanal skincare brands with fast product discovery and strong above-the-fold trust signals.",
  },
} satisfies MarketplaceThemeDefinition;

export const ecosoapBoutiqueThemeSettingsSchema: ThemeSettingsSchema = {
  version: ecosoapBoutiqueTheme.version,
  fields: [
    { id: "brand_name", type: "text", label: "Brand name", defaultValue: "EcoSoap" },
    {
      id: "brand_tagline",
      type: "textarea",
      label: "Brand tagline",
      defaultValue: "Handcrafted organic skincare for sensitive, happy skin.",
    },
    {
      id: "header_badge_text",
      type: "text",
      label: "Header badge text",
      defaultValue: "Handcrafted Organic",
    },
    {
      id: "header_trust_text",
      type: "text",
      label: "Header trust text",
      defaultValue: "100% Zero Plastic",
    },
    {
      id: "hero_badge_text",
      type: "text",
      label: "Hero badge",
      defaultValue: "Cold-Processed & Cured for 6 Weeks",
    },
    { id: "hero_title", type: "text", label: "Hero title", defaultValue: "Nourish Your Barrier," },
    {
      id: "hero_highlight_text",
      type: "text",
      label: "Hero highlight text",
      defaultValue: "Purely From Earth.",
    },
    {
      id: "hero_description",
      type: "textarea",
      label: "Hero description",
      defaultValue: ecosoapBoutiqueTheme.preset.heroDescription,
    },
    {
      id: "hero_primary_cta",
      type: "text",
      label: "Primary CTA label",
      defaultValue: "Explore Soap Catalog",
    },
    {
      id: "hero_secondary_cta",
      type: "text",
      label: "Secondary CTA label",
      defaultValue: "Launch Virtual Soap Lab",
    },
    {
      id: "hero_image",
      type: "image",
      label: "Hero image",
      defaultValue: "/themes/ecosoap/hero_soap_banner.png",
    },
    {
      id: "hero_featured_badge",
      type: "text",
      label: "Hero featured badge",
      defaultValue: "Featured Batch",
    },
    {
      id: "hero_featured_title",
      type: "text",
      label: "Hero featured title",
      defaultValue: "French Lavender & Oatmeal Meadow",
    },
    {
      id: "hero_side_badge_top",
      type: "text",
      label: "Hero top side badge",
      defaultValue: "Cure Batch #942 Fully Aged",
    },
    {
      id: "hero_side_badge_bottom",
      type: "text",
      label: "Hero bottom side badge",
      defaultValue: "Plastic-Free Shipping",
    },
    {
      id: "products_heading",
      type: "text",
      label: "Products section heading",
      defaultValue: "Handcrafted Scent Collections",
    },
    {
      id: "products_subheading",
      type: "textarea",
      label: "Products section subheading",
      defaultValue:
        "Every bar is crafted in cold processes, cured for at least six weeks, and presented with a premium botanical catalog experience.",
    },
    {
      id: "empty_products_title",
      type: "text",
      label: "Empty products title",
      defaultValue: "No Botanicals Found",
    },
    {
      id: "empty_products_description",
      type: "text",
      label: "Empty products description",
      defaultValue: "Try searching another herb or clearing filters.",
    },
    {
      id: "header_style",
      type: "select",
      label: "Header style",
      defaultValue: "editorial",
      options: [
        { label: "Editorial", value: "editorial" },
        { label: "Compact", value: "compact" },
      ],
    },
    {
      id: "product_grid_columns",
      type: "select",
      label: "Product grid columns",
      defaultValue: "3",
      options: [
        { label: "2 columns", value: "2" },
        { label: "3 columns", value: "3" },
        { label: "4 columns", value: "4" },
      ],
    },
    {
      id: "section_spacing",
      type: "select",
      label: "Section spacing",
      defaultValue: "comfortable",
      options: [
        { label: "Compact", value: "compact" },
        { label: "Comfortable", value: "comfortable" },
        { label: "Airy", value: "airy" },
      ],
    },
    {
      id: "footer_style",
      type: "select",
      label: "Footer style",
      defaultValue: "editorial",
      options: [
        { label: "Editorial", value: "editorial" },
        { label: "Minimal", value: "minimal" },
      ],
    },
    {
      id: "show_social_links",
      type: "boolean",
      label: "Show social links",
      defaultValue: true,
    },
    {
      id: "footer_description",
      type: "textarea",
      label: "Footer description",
      defaultValue:
        "Dedicated to botanical skincare, premium store presentation, and a shared commerce backend built for repeatable storefront themes.",
    },
    {
      id: "footer_menu_title",
      type: "text",
      label: "Footer menu title",
      defaultValue: "The Saponary",
    },
    {
      id: "footer_assurances_title",
      type: "text",
      label: "Footer assurances title",
      defaultValue: "Green Assurances",
    },
    {
      id: "footer_privacy_label",
      type: "text",
      label: "Footer privacy link label",
      defaultValue: "Privacy Charter",
    },
    {
      id: "footer_sustainability_label",
      type: "text",
      label: "Footer sustainability link label",
      defaultValue: "Zero Waste Vow",
    },
  ],
  groups: [
    { id: "brand", label: "Brand", fields: ["brand_name", "brand_tagline", "header_badge_text", "header_trust_text"] },
    {
      id: "hero",
      label: "Hero",
      fields: [
        "hero_badge_text",
        "hero_title",
        "hero_highlight_text",
        "hero_description",
        "hero_primary_cta",
        "hero_secondary_cta",
        "hero_image",
        "hero_featured_badge",
        "hero_featured_title",
        "hero_side_badge_top",
        "hero_side_badge_bottom",
      ],
    },
    {
      id: "products",
      label: "Products",
      fields: ["products_heading", "products_subheading", "empty_products_title", "empty_products_description"],
    },
    {
      id: "layout",
      label: "Layout",
      fields: ["header_style", "product_grid_columns", "section_spacing", "footer_style"],
    },
    {
      id: "footer",
      label: "Footer",
      fields: [
        "show_social_links",
        "footer_description",
        "footer_menu_title",
        "footer_assurances_title",
        "footer_privacy_label",
        "footer_sustainability_label",
      ],
    },
  ],
};

export const ecosoapBoutiqueThemeBlockSchema: ThemeBlockSchema[] = [
  {
    type: "heading",
    label: "Heading",
    description: "Primary headline block for hero and featured sections.",
  },
  {
    type: "subheading",
    label: "Subheading",
    description: "Secondary supporting copy under a heading.",
  },
  {
    type: "cta-button",
    label: "CTA button",
    description: "Primary action button for conversion-focused sections.",
  },
  {
    type: "image",
    label: "Image",
    description: "Reusable image block for banners and product storytelling.",
  },
  {
    type: "badge",
    label: "Badge",
    description: "Small trust or promotional label.",
  },
  {
    type: "trust-indicator",
    label: "Trust indicator",
    description: "Reusable proof point such as cruelty-free or vegan assurance.",
  },
  {
    type: "testimonial",
    label: "Testimonial",
    description: "Customer review or testimonial card.",
  },
  {
    type: "faq-item",
    label: "FAQ item",
    description: "Single expandable question and answer block.",
  },
];

export const ecosoapBoutiqueThemeSectionSchema: ThemeSectionSchema[] = [
  {
    page: "home",
    type: "announcement-bar",
    label: "Announcement bar",
    description: "Top strip for promos and shipping updates.",
    settings: [
      { id: "text", type: "text", label: "Message", defaultValue: "Free shipping over Rs. 999" },
      { id: "enabled", type: "boolean", label: "Enabled", defaultValue: true },
    ],
  },
  {
    page: "home",
    type: "header",
    label: "Header",
    description: "Navigation and brand header.",
    settings: [
      { id: "compact", type: "boolean", label: "Compact header", defaultValue: false },
    ],
  },
  {
    page: "home",
    type: "hero",
    label: "Hero",
    description: "Main landing hero with CTA and featured image.",
    settings: [
      { id: "headline", type: "text", label: "Headline", defaultValue: "Nourish Your Barrier," },
      { id: "subtitle", type: "textarea", label: "Subtitle", defaultValue: ecosoapBoutiqueTheme.preset.heroDescription },
    ],
    allowedBlocks: ["heading", "subheading", "cta-button", "image", "badge", "trust-indicator"],
    maxBlocks: 6,
    defaultBlocks: ["heading", "subheading", "cta-button", "image"],
  },
  {
    page: "home",
    type: "featured-categories",
    label: "Featured categories",
    description: "Curated category list for fast browsing.",
    settings: [
      { id: "limit", type: "number", label: "Category count", defaultValue: 6, min: 3, max: 12, step: 1 },
    ],
    allowedBlocks: ["badge", "image"],
  },
  {
    page: "home",
    type: "featured-products",
    label: "Featured products",
    description: "Grid of best-selling or curated products.",
    settings: [
      { id: "limit", type: "number", label: "Product count", defaultValue: 8, min: 4, max: 16, step: 1 },
    ],
    allowedBlocks: ["badge", "trust-indicator", "testimonial"],
  },
  {
    page: "home",
    type: "reviews",
    label: "Reviews",
    description: "Social proof from customers.",
    allowedBlocks: ["testimonial"],
  },
  {
    page: "home",
    type: "instagram-reels",
    label: "Instagram reels",
    description: "Social content strip for discovery.",
    allowedBlocks: ["image", "badge"],
  },
  {
    page: "home",
    type: "footer",
    label: "Footer",
    description: "Footer with links and store trust signals.",
    settings: [
      { id: "show_social_links", type: "boolean", label: "Show social links", defaultValue: true },
    ],
    allowedBlocks: ["trust-indicator", "badge"],
  },
  {
    page: "products",
    type: "product-grid",
    label: "Product grid",
    description: "Reusable catalog grid used across product listing pages.",
    settings: [
      { id: "columns", type: "select", label: "Columns", defaultValue: "3", options: [
        { label: "2 columns", value: "2" },
        { label: "3 columns", value: "3" },
        { label: "4 columns", value: "4" },
      ] },
    ],
    allowedBlocks: ["badge", "trust-indicator"],
  },
  {
    page: "product-detail",
    type: "product-gallery",
    label: "Product gallery",
    description: "Image and media gallery for a product page.",
    allowedBlocks: ["image", "badge"],
  },
  {
    page: "product-detail",
    type: "product-summary",
    label: "Product summary",
    description: "Price, description, variant and add-to-cart area.",
    allowedBlocks: ["heading", "subheading", "cta-button", "trust-indicator"],
  },
  {
    page: "cart",
    type: "cart-summary",
    label: "Cart summary",
    description: "Reusable cart summary and checkout reminder.",
    allowedBlocks: ["badge", "trust-indicator"],
  },
  {
    page: "about",
    type: "rich-text",
    label: "Rich text",
    description: "Simple editorial content block for the about page.",
    allowedBlocks: ["heading", "subheading", "image"],
  },
  {
    page: "policies",
    type: "policy-sections",
    label: "Policy sections",
    description: "Structured policy content for static policy pages.",
    allowedBlocks: ["faq-item", "heading", "subheading"],
  },
];

export const ecosoapBoutiqueThemeDefaultSettings = {
  brand_name: "EcoSoap",
  brand_tagline: "Handcrafted organic skincare for sensitive, happy skin.",
  header_badge_text: "Handcrafted Organic",
  header_trust_text: "100% Zero Plastic",
  hero_badge_text: "Cold-Processed & Cured for 6 Weeks",
  hero_title: "Nourish Your Barrier,",
  hero_highlight_text: "Purely From Earth.",
  hero_description: ecosoapBoutiqueTheme.preset.heroDescription,
  hero_primary_cta: "Explore Soap Catalog",
  hero_secondary_cta: "Launch Virtual Soap Lab",
  hero_image: "/themes/ecosoap/hero_soap_banner.png",
  hero_featured_badge: "Featured Batch",
  hero_featured_title: "French Lavender & Oatmeal Meadow",
  hero_side_badge_top: "Cure Batch #942 Fully Aged",
  hero_side_badge_bottom: "Plastic-Free Shipping",
  products_heading: "Handcrafted Scent Collections",
  products_subheading:
    "Every bar is crafted in cold processes, cured for at least six weeks, and presented with a premium botanical catalog experience.",
  empty_products_title: "No Botanicals Found",
  empty_products_description: "Try searching another herb or clearing filters.",
  header_style: "editorial",
  product_grid_columns: "3",
  section_spacing: "comfortable",
  footer_style: "editorial",
  show_social_links: true,
  footer_description:
    "Dedicated to botanical skincare, premium store presentation, and a shared commerce backend built for repeatable storefront themes.",
  footer_menu_title: "The Saponary",
  footer_assurances_title: "Green Assurances",
  footer_privacy_label: "Privacy Charter",
  footer_sustainability_label: "Zero Waste Vow",
} as const;
