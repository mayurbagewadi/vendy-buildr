/**
 * AI Site Context Manifest
 *
 * Static registry of ALL data-ai selectors across every customer-facing page.
 * Sent to the AI with every design request so it can write CSS that targets
 * the ENTIRE store — not just the home page shown in the preview iframe.
 *
 * The AI preview iframe only shows the home page. Without this manifest,
 * the AI is blind to Products, ProductDetail, Cart, Checkout, Categories pages.
 */

export const STORE_SITE_MANIFEST = {
  pages: {
    home: {
      description: "Store homepage — hero, featured categories, product grid, about section",
      selectors: {
        header:              "[data-ai='header']            — sticky top nav bar with logo, links, search, cart icon",
        hero:                "[data-ai='section-hero']      — full-width hero banner with headline, subtitle, CTA button",
        categories_section:  "[data-ai='section-categories'] — horizontal scrollable category chips/cards row",
        category_card:       "[data-ai='category-card']     — individual category card (image + name)",
        featured_section:    "[data-ai='section-featured']  — 'Featured Products' section heading + product grid",
        product_card:        "[data-ai='product-card']      — individual product card (image, name, price, add button)",
        footer:              "[data-ai='section-footer']    — footer with store info, social links, policies",
      }
    },
    products: {
      description: "All Products listing page — filterable grid of all store products",
      selectors: {
        filter_sidebar:  "[data-ai='filter-sidebar']  — left sidebar with category checkboxes and price range slider",
        products_grid:   "[data-ai='products-grid']   — main area with sort dropdown, product count, and product cards grid",
      }
    },
    product_detail: {
      description: "Individual product detail page — full product info, buy flow",
      selectors: {
        product_gallery:     "[data-ai='product-gallery']     — left column: image carousel/thumbnails + video",
        product_info:        "[data-ai='product-info']        — right column: category badge, name, description, price",
        variant_selector:    "[data-ai='variant-selector']    — card with variant radio buttons (size/color/etc) and prices",
        quantity_selector:   "[data-ai='quantity-selector']   — quantity +/- stepper with running total",
        product_actions:     "[data-ai='product-actions']     — desktop action buttons: Add to Cart, Share",
        related_products:    "[data-ai='related-products']    — 'More Products' section at bottom with related product cards",
        mobile_add_to_cart:  "[data-ai='mobile-add-to-cart']  — fixed bottom bar on mobile with price + Add to Cart button",
      }
    },
    categories: {
      description: "Browse by Category page — grid of all store categories",
      selectors: {
        categories_page:  "[data-ai='categories-page']  — full section with hero heading + categories grid",
        categories_grid:  "[data-ai='categories-grid']  — responsive grid of category cards (image + name + product count)",
      }
    },
    cart: {
      description: "Shopping Cart page — review items, quantities, proceed to checkout",
      selectors: {
        cart_items:    "[data-ai='cart-items']   — left column: list of cart item cards (image, name, variant, qty stepper, price)",
        cart_summary:  "[data-ai='cart-summary'] — right column: order summary card with subtotal, delivery, total, checkout button",
      }
    },
    checkout: {
      description: "Checkout page — customer info form, delivery address, payment",
      selectors: {
        checkout_form:     "[data-ai='checkout-form']     — left column: customer info + address + payment method cards",
        checkout_summary:  "[data-ai='checkout-summary']  — right column: order summary with items, totals, coupon, place order button",
        price_subtotal:    "[data-ai='price-subtotal']    — subtotal amount display (₹xxx)",
        price_delivery:    "[data-ai='price-delivery']    — delivery cost display (FREE)",
        price_total:       "[data-ai='price-total']       — final total amount display (₹xxx)",
      }
    },
  },

  shared_components: {
    description: "Components that appear on multiple pages",
    selectors: {
      header:       "[data-ai='header']         — present on ALL pages (sticky nav)",
      footer:       "[data-ai='section-footer'] — present on home page and product detail",
      product_card: "[data-ai='product-card']   — appears on home page, products page, and related products",
    }
  }
};

/**
 * Returns a compact string version of the manifest for inclusion in AI prompts.
 * Format is optimized for token efficiency (~1500 tokens).
 */
export function getManifestForPrompt(): string {
  return `STORE SITE MANIFEST — All designable elements across every page:

HOME PAGE:
  [data-ai="header"]             sticky nav: logo, links, search, cart, WhatsApp button
  [data-ai="section-hero"]       hero banner: headline, subtitle, CTA button
  [data-ai="section-categories"] horizontal category chips row
  [data-ai="category-card"]      individual category card (image + name)
  [data-ai="section-featured"]   featured products section with heading
  [data-ai="product-card"]       individual product card (image, name, price, add button)
  [data-ai="section-footer"]     footer: store info, social links, policies

PRODUCTS PAGE (/products):
  [data-ai="filter-sidebar"]     left sidebar: category filters + price range slider
  [data-ai="products-grid"]      main area: sort dropdown + product cards grid

PRODUCT DETAIL PAGE (/products/:slug):
  [data-ai="product-gallery"]    image carousel + thumbnails + video
  [data-ai="product-info"]       category badge, name, description, price display
  [data-ai="variant-selector"]   variant radio buttons card (size/color/etc)
  [data-ai="quantity-selector"]  quantity stepper (+/-) with total price
  [data-ai="product-actions"]    desktop: Add to Cart + Share buttons
  [data-ai="related-products"]   'More Products' section at bottom
  [data-ai="mobile-add-to-cart"] mobile: fixed bottom bar with price + Add to Cart

CATEGORIES PAGE (/categories):
  [data-ai="categories-page"]    full section with hero heading
  [data-ai="categories-grid"]    responsive grid of category cards

CART PAGE (/cart):
  [data-ai="cart-items"]         cart item cards (image, name, qty stepper, price)
  [data-ai="cart-summary"]       order summary: subtotal, delivery, total, checkout button

CHECKOUT PAGE (/checkout):
  [data-ai="checkout-form"]      customer info + address + payment method selection
  [data-ai="checkout-summary"]   order items, totals, coupon input, place order button
  [data-ai="price-subtotal"]     subtotal amount (₹xxx)
  [data-ai="price-delivery"]     delivery cost (FREE)
  [data-ai="price-total"]        final total amount (₹xxx)

IMPORTANT: Write CSS for ALL relevant selectors — not just what you see in the preview.
The preview shows the home page only. Your CSS will be applied to ALL pages listed above.`;
}
