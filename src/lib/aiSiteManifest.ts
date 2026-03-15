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
        filter_sidebar:           "[data-ai='filter-sidebar']           — left sidebar with category checkboxes and price range slider",
        products_grid:            "[data-ai='products-grid']            — main area with sort dropdown, product count, and product cards grid",
        products_count:           "[data-ai='products-count']           — text showing number of products displayed",
        sort_button:              "[data-ai='sort-button']              — dropdown to sort products by newest/price/name",
        category_checkboxes:      "[data-ai='category-checkboxes']      — category filter checkboxes container",
        price_range_slider:       "[data-ai='price-range-slider']       — price range slider for filtering",
        clear_filters_button:     "[data-ai='clear-filters-button']     — button to clear all active filters",
        filter_toggle_mobile:     "[data-ai='filter-toggle-mobile']     — button to toggle filter sidebar on mobile",
      }
    },
    product_detail: {
      description: "Individual product detail page — full product info, buy flow",
      selectors: {
        product_gallery:          "[data-ai='product-gallery']          — left column: image carousel/thumbnails + video",
        product_info:             "[data-ai='product-info']             — right column: category badge, name, description, price",
        category_badge:           "[data-ai='category-badge']           — badge showing product category",
        product_name:             "[data-ai='product-name']             — h1 heading with product name",
        product_description:      "[data-ai='product-description']      — product description text",
        product_price:            "[data-ai='product-price']            — price display (when no variants)",
        variant_selector:         "[data-ai='variant-selector']         — card with variant radio buttons (size/color/etc) and prices",
        quantity_selector:        "[data-ai='quantity-selector']        — quantity +/- stepper with running total",
        product_actions:          "[data-ai='product-actions']          — desktop action buttons: Add to Cart, Share",
        product_sku:              "[data-ai='product-sku']              — SKU/product code in details section",
        product_availability:     "[data-ai='product-availability']     — stock status display in details section",
        related_products:         "[data-ai='related-products']         — 'More Products' section at bottom with related product cards",
        more_products_heading:    "[data-ai='more-products-heading']    — 'More Products' section h2 heading",
        mobile_add_to_cart:       "[data-ai='mobile-add-to-cart']       — fixed bottom bar on mobile with price + Add to Cart button",
      }
    },
    categories: {
      description: "Browse by Category page — grid of all store categories",
      selectors: {
        categories_page:              "[data-ai='categories-page']              — full section with hero heading + categories grid",
        categories_hero_heading:      "[data-ai='categories-hero-heading']      — h1 'Shop by Category' heading",
        categories_hero_subtitle:     "[data-ai='categories-hero-subtitle']     — subtitle text below heading",
        categories_grid:              "[data-ai='categories-grid']              — responsive grid of category cards (image + name + product count)",
        category_card:                "[data-ai='category-card']                — individual category card wrapper",
        category_card_inner:          "[data-ai='category-card-inner']          — Card component with border and shadow",
        category_card_image_container: "[data-ai='category-card-image-container'] — image container with aspect ratio",
        category_card_image:          "[data-ai='category-card-image']          — category image",
        category_card_overlay:        "[data-ai='category-card-overlay']        — gradient overlay on image",
        category_card_name:           "[data-ai='category-card-name']           — category name text",
        category_card_count:          "[data-ai='category-card-count']          — product count badge",
      }
    },
    cart: {
      description: "Shopping Cart page — review items, quantities, proceed to checkout",
      selectors: {
        cart_items:              "[data-ai='cart-items']              — left column: list of cart item cards",
        cart_page_heading:       "[data-ai='cart-page-heading']       — h1 'Shopping Cart' heading",
        cart_item_image:         "[data-ai='cart-item-image']         — product image in cart item card",
        cart_item_name:          "[data-ai='cart-item-name']          — product name in cart item",
        cart_item_variant:       "[data-ai='cart-item-variant']       — variant/size display in cart item",
        cart_item_price:         "[data-ai='cart-item-price']         — price for item quantity in cart",
        quantity_buttons:        "[data-ai='quantity-buttons']        — +/- buttons to adjust quantity",
        remove_item_button:      "[data-ai='remove-item-button']      — X button to remove item from cart",
        cart_summary:            "[data-ai='cart-summary']            — right column: order summary card",
        order_summary_labels:    "[data-ai='order-summary-labels']    — subtotal, delivery, total labels in summary",
        checkout_button:         "[data-ai='checkout-button']         — 'Proceed to Checkout' button",
      }
    },
    checkout: {
      description: "Checkout page — customer info form, delivery address, payment",
      selectors: {
        checkout_form:                "[data-ai='checkout-form']                — left column: customer info + address + payment method cards",
        customer_info_heading:        "[data-ai='customer-info-heading']        — 'Customer Information' section heading",
        delivery_address_heading:     "[data-ai='delivery-address-heading']     — 'Delivery Address' section heading",
        payment_method_heading:       "[data-ai='payment-method-heading']       — 'Payment Method' section heading",
        checkout_summary:             "[data-ai='checkout-summary']             — right column: order summary with items, totals, coupon, place order button",
        price_subtotal:               "[data-ai='price-subtotal']               — subtotal amount display (₹xxx)",
        price_delivery:               "[data-ai='price-delivery']               — delivery cost display (FREE)",
        price_total:                  "[data-ai='price-total']                  — final total amount display (₹xxx)",
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
  [data-ai="product-card"]       individual product card. Inner HTML: Card > CardContent(image) + CardContent(category text + h3 name + p.text-primary price) + CardFooter(Button "View Details"). To style button: [data-ai="product-card"] button. To style price: [data-ai="product-card"] p.text-primary or override --primary. Do NOT use > div:last-child — use descendant selectors instead.
  [data-ai="section-footer"]     footer: store info, social links, policies

PRODUCTS PAGE (/products):
  [data-ai="filter-sidebar"]     left sidebar: category filters + price range slider
  [data-ai="products-grid"]      main area: sort dropdown + product cards grid
  [data-ai="products-count"]     text showing number of products displayed
  [data-ai="sort-button"]        dropdown to sort products
  [data-ai="category-checkboxes"] category filter checkboxes
  [data-ai="price-range-slider"] price range slider for filtering
  [data-ai="clear-filters-button"] button to clear all active filters
  [data-ai="filter-toggle-mobile"] button to toggle filters on mobile

PRODUCT DETAIL PAGE (/products/:slug):
  [data-ai="product-gallery"]    image carousel + thumbnails + video
  [data-ai="product-info"]       category badge, name, description, price
  [data-ai="category-badge"]     badge showing product category
  [data-ai="product-name"]       h1 heading with product name
  [data-ai="product-description"] product description text
  [data-ai="product-price"]      price display (when no variants)
  [data-ai="variant-selector"]   variant radio buttons card (size/color/etc)
  [data-ai="quantity-selector"]  quantity stepper (+/-) with total price
  [data-ai="product-actions"]    desktop: Add to Cart + Share buttons
  [data-ai="product-sku"]        SKU/product code in details section
  [data-ai="product-availability"] stock status display
  [data-ai="related-products"]   'More Products' section at bottom
  [data-ai="more-products-heading"] 'More Products' section h2 heading
  [data-ai="mobile-add-to-cart"] mobile: fixed bottom bar with price + Add to Cart

CATEGORIES PAGE (/categories):
  [data-ai="categories-page"]    full section with hero heading
  [data-ai="categories-hero-heading"] h1 'Shop by Category' heading
  [data-ai="categories-hero-subtitle"] subtitle text below heading
  [data-ai="categories-grid"]    responsive grid of category cards
  [data-ai="category-card"]      individual category card wrapper
  [data-ai="category-card-inner"] Card component with border and shadow
  [data-ai="category-card-image-container"] image container with aspect ratio
  [data-ai="category-card-image"] category image
  [data-ai="category-card-overlay"] gradient overlay on image
  [data-ai="category-card-name"]  category name text
  [data-ai="category-card-count"] product count badge

CART PAGE (/cart):
  [data-ai="cart-items"]         cart item cards (image, name, qty stepper, price)
  [data-ai="cart-page-heading"]  h1 'Shopping Cart' heading
  [data-ai="cart-item-image"]    product image in cart item card
  [data-ai="cart-item-name"]     product name in cart item
  [data-ai="cart-item-variant"]  variant/size display in cart item
  [data-ai="cart-item-price"]    price for item quantity
  [data-ai="quantity-buttons"]   +/- buttons to adjust quantity
  [data-ai="remove-item-button"] X button to remove item from cart
  [data-ai="cart-summary"]       order summary: subtotal, delivery, total, checkout
  [data-ai="order-summary-labels"] subtotal, delivery, total labels
  [data-ai="checkout-button"]    'Proceed to Checkout' button

CHECKOUT PAGE (/checkout):
  [data-ai="checkout-form"]      customer info + address + payment method selection
  [data-ai="customer-info-heading"] 'Customer Information' section heading
  [data-ai="delivery-address-heading"] 'Delivery Address' section heading
  [data-ai="payment-method-heading"] 'Payment Method' section heading
  [data-ai="checkout-summary"]   order items, totals, coupon input, place order button
  [data-ai="price-subtotal"]     subtotal amount (₹xxx)
  [data-ai="price-delivery"]     delivery cost (FREE)
  [data-ai="price-total"]        final total amount (₹xxx)

IMPORTANT: Write CSS for ALL relevant selectors — not just what you see in the preview.
The preview shows the home page only. Your CSS will be applied to ALL pages listed above.`;
}
