// Ported from supabase/functions/ai-designer/index.ts (gtSharedPreamble,
// gtPageSectionPrompt, gtBuildSystemPrompt, gtValidateHTML, GT_REQUIRED_IDS,
// GT_MAX_TOKENS). Keep this file in sync with that one if the prompt/contract
// changes — the edge function no longer generates pages itself (it only
// enqueues), so this is now the single place page prompts are built.
// No Deno-bundler string-concat constraint here (this runs on Node), so
// template literals are used instead — content is identical either way.

export const GT_PAGE_TYPES = [
  "home", "products", "categories", "product_detail", "cart", "about", "policies",
] as const;
export type GtPageType = (typeof GT_PAGE_TYPES)[number];

export const GT_REQUIRED_IDS: Record<GtPageType, string[]> = {
  home: ["menu-toggle", "mobile-menu", "cart-count", "categories-row", "products-grid"],
  products: ["menu-toggle", "mobile-menu", "cart-count", "products-grid"],
  categories: ["menu-toggle", "mobile-menu", "cart-count", "categories-grid"],
  product_detail: ["menu-toggle", "mobile-menu", "cart-count", "product-title", "product-price", "add-to-cart-btn"],
  cart: ["menu-toggle", "mobile-menu", "cart-count", "cart-items", "cart-total", "checkout-btn"],
  about: ["menu-toggle", "mobile-menu", "cart-count", "about-content"],
  policies: ["menu-toggle", "mobile-menu", "cart-count", "policies-content"],
};

export const GT_MAX_TOKENS: Record<GtPageType, number> = {
  home: 8000, products: 6000, categories: 4000,
  product_detail: 5000, cart: 5000, about: 3000, policies: 3000,
};

export function gtValidateHTML(pageType: GtPageType, html: string): { valid: boolean; missing: string[] } {
  const required = GT_REQUIRED_IDS[pageType] || [];
  const missing = required.filter(
    (id) => !html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)
  );
  return { valid: missing.length === 0, missing };
}

function gtSharedPreamble(): string {
  return `You are an expert ecommerce UI developer. Generate a COMPLETE, STANDALONE HTML page for an ecommerce store.

OUTPUT FORMAT (STRICT):
- Output ONLY raw HTML — start with <!DOCTYPE html>, end with </html>
- No markdown, no code fences, no explanation
- All CSS inside one <style> block in <head>
- All JavaScript inside ONE <script> block at the very bottom of <body>
- Google Fonts <link> in <head> is allowed
- No external scripts, no CDN libraries, no external images

SANDBOX RESTRICTIONS — these APIs are BLOCKED and will silently fail or throw errors:
- BLOCKED: alert(), confirm(), prompt() — sandboxed iframe, no modals allowed
- BLOCKED: localStorage, sessionStorage, document.cookie
- BLOCKED: fetch(), XMLHttpRequest — use VendyBridge instead
- BLOCKED: onclick attribute with dynamic data like onclick="fn('" + id + "')" — causes SyntaxError
- RULE: NEVER put dynamic values inside HTML attribute strings. Use data-* attributes + addEventListener.

VENDY BRIDGE — your only data source, always available as window.VendyBridge:
  VendyBridge.getStore()            -> Promise<{name,description,logo_url,whatsapp_number,address}>
  VendyBridge.getProducts(n)        -> Promise<[{id,slug,name,base_price,offer_price,images,category}]>
  VendyBridge.getCategories()       -> Promise<[{id,name,image_url}]>
  VendyBridge.getCurrentProduct()   -> Promise<{id,slug,name,base_price,offer_price,images,category,description}|null>  (product_detail page ONLY — resolves to the product the customer navigated to)
  VendyBridge.addToCart(id,qty)     -> Promise (id = product.id, qty = integer)
  VendyBridge.getCart()             -> Promise<[{productId,name,price,qty,image}]>
  VendyBridge.updateCartQty(id,qty) -> Promise  (cart page ONLY)
  VendyBridge.removeFromCart(id)    -> Promise  (cart page ONLY)
  VendyBridge.navigateTo(path)      -> void ('/products', '/products/'+slug, '/categories', '/cart', '/checkout', '/about', '/policies', '/')
  VendyBridge.openWhatsApp(msg)     -> void

NAVIGATION & STRUCTURE RULES (non-negotiable, apply to every page):
- NEVER give links a real href like href='/products' — that causes a full page reload and 404s outside the sandbox. Use href='#' class='nav-link' data-path='/products', wired with addEventListener + VendyBridge.navigateTo(this.getAttribute('data-path')), wrapped in its own try/catch
- Header MUST contain exactly 4 links with class='nav-link': data-path='/' (Home), data-path='/products' (Products), data-path='/categories' (Categories), data-path='/cart' (Cart)
- Hamburger button MUST have id='menu-toggle'; the mobile nav it opens MUST have id='mobile-menu'
- Cart count badge MUST have id='cart-count', starting at 0, updated after every addToCart/updateCartQty/removeFromCart
- NEVER hardcode product/category/store data in HTML — ALL of it comes from VendyBridge, fetched inside a DOMContentLoaded listener
- EVERY feature block (menu toggle, nav links, data loading, page-specific actions) MUST be wrapped in its own try/catch so one failing block never breaks the others
- Checkout is a real, separate, non-AI page — a 'Checkout' button just calls VendyBridge.navigateTo('/checkout'). NEVER attempt to build payment/checkout logic yourself.
- Mobile responsive (320px to 1440px)

`;
}

function gtPageSectionPrompt(pageType: GtPageType): string {
  switch (pageType) {
    case "home":
      return `PAGE: Home

REQUIRED SECTIONS:
1. Header — store name + 4 nav links + hamburger + mobile nav + cart badge (as specified above)
2. Hero — headline + subtext + CTA calling VendyBridge.navigateTo('/products')
3. <div id='categories-row'></div> — leave empty, JS fills it from VendyBridge.getCategories(), each card calling VendyBridge.navigateTo('/categories') on click
4. <div id='products-grid'></div> — leave empty, JS fills it from VendyBridge.getProducts(12) (teaser only, NOT the full catalog), each card navigates to VendyBridge.navigateTo('/products/' + slug) on click, its own 'Add to Cart' button stops propagation and calls VendyBridge.addToCart
5. Footer — store name + WhatsApp button calling VendyBridge.openWhatsApp()

`;
    case "products":
      return `PAGE: Products (full catalog listing — NOT the home teaser)

REQUIRED SECTIONS:
1. Header — same nav/hamburger/cart-badge as specified above
2. Page heading, e.g. 'All Products'
3. <div id='products-grid'></div> — leave empty, JS fills it from VendyBridge.getProducts(100). Each card shows image/name/price, navigates to VendyBridge.navigateTo('/products/' + slug) on click; its own 'Add to Cart' button stops propagation and calls VendyBridge.addToCart, then refreshes the #cart-count badge from VendyBridge.getCart()
4. Footer

`;
    case "categories":
      return `PAGE: Categories (full list — NOT the home teaser row)

REQUIRED SECTIONS:
1. Header — same nav/hamburger/cart-badge as specified above
2. Page heading, e.g. 'Shop by Category'
3. <div id='categories-grid'></div> — leave empty, JS fills it from VendyBridge.getCategories(). Each card navigates to VendyBridge.navigateTo('/products') on click (category filtering happens on the products page, not here)
4. Footer

`;
    case "product_detail":
      return `PAGE: Product Detail — ONE reusable template. It is never regenerated per product; at runtime VendyBridge.getCurrentProduct() resolves to whichever product the customer opened.

REQUIRED SECTIONS:
1. Header — same nav/hamburger/cart-badge as specified above
2. Product image(s) — container id='product-images'
3. Product name — element id='product-title'
4. Price — element id='product-price'
5. 'Add to Cart' button id='add-to-cart-btn' calling VendyBridge.addToCart(product.id, 1), then refreshing #cart-count from VendyBridge.getCart()
6. JS: on load, call VendyBridge.getCurrentProduct(); if it resolves to null, show a simple 'Product not found' message instead of the sections above
7. Footer

`;
    case "cart":
      return `PAGE: Cart

REQUIRED SECTIONS:
1. Header — same nav/hamburger/cart-badge as specified above
2. <div id='cart-items'></div> — leave empty, JS fills it from VendyBridge.getCart(). Each row shows image/name/price/qty, a quantity input or +/- buttons calling VendyBridge.updateCartQty(productId, newQty), and a remove button calling VendyBridge.removeFromCart(productId) — after either call, re-fetch VendyBridge.getCart() and re-render this section plus #cart-total and #cart-count
3. Total — element id='cart-total' showing the sum of price*qty across cart items
4. 'Checkout' button id='checkout-btn' calling VendyBridge.navigateTo('/checkout') — this is a real separate page, do not build checkout logic here
5. If the cart is empty, show a simple empty-state message instead of items/total
6. Footer

`;
    case "about":
      return `PAGE: About

REQUIRED SECTIONS:
1. Header — same nav/hamburger/cart-badge as specified above
2. <div id='about-content'></div> — leave empty, JS fills it from VendyBridge.getStore() (name, description, address) — simple story/brand page, no product data needed
3. Footer

`;
    case "policies":
    default:
      return `PAGE: Policies

REQUIRED SECTIONS:
1. Header — same nav/hamburger/cart-badge as specified above
2. <div id='policies-content'></div> — static shipping / returns / privacy sections written from the store's description (from VendyBridge.getStore()); this content does not need to be dynamic beyond the store name
3. Footer

`;
  }
}

export function gtBuildSystemPrompt(
  pageType: GtPageType,
  storeName: string,
  description: string,
  whatsapp: string,
  categoriesStr: string,
  categoriesCount: number,
  productsStr: string,
  productsCount: number,
  designBrief: string
): string {
  return (
    gtSharedPreamble() +
    gtPageSectionPrompt(pageType) +
    `STORE CONTEXT:
Name: ${storeName}
Description: ${description}
WhatsApp: ${whatsapp || "not set"}
Categories (${categoriesCount}): ${categoriesStr}
Products (${productsCount} — for context only, render dynamically from VendyBridge):
${productsStr}

Design brief (apply consistently across every page — same colors, fonts, header/footer style): ${designBrief}

Generate the complete HTML now, starting with <!DOCTYPE html>:`
  );
}
