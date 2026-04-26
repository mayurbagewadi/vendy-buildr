import blog1Raw from "../../blogs/blog-1-best-ecommerce-website-builder.md?raw";
import blog2Raw from "../../blogs/blog-2-wix-vs-wordpress-ecommerce.md?raw";
import blog3Raw from "../../blogs/blog-3-do-i-need-llc-ecommerce-india.md?raw";
import blog4Raw from "../../blogs/blog-4-cheapest-ecommerce-website-builder.md?raw";
import blog5Raw from "../../blogs/blog-5-is-wix-free-forever.md?raw";
import blog6Raw from "../../blogs/blog-6-cheaper-option-than-wix.md?raw";
import blog7Raw from "../../blogs/blog-7-100-percent-free-website-builder.md?raw";
import blog8Raw from "../../blogs/blog-8-types-of-ecommerce.md?raw";
import blog9Raw from "../../blogs/blog-9-shopify-alternative-india.md?raw";
import blog10Raw from "../../blogs/blog-10-whatsapp-store-india.md?raw";
import blog11Raw from "../../blogs/blog-11-how-to-sell-online-india.md?raw";
import blog12Raw from "../../blogs/blog-12-no-code-ecommerce-builder-india.md?raw";
import blog13Raw from "../../blogs/blog-13-online-dukan-kaise-banaye.md?raw";
import blog14Raw from "../../blogs/blog-14-free-ecommerce-website-builder-india.md?raw";
import blog15Raw from "../../blogs/blog-15-online-store-builder-india.md?raw";
import blog16Raw from "../../blogs/blog-16-best-ecommerce-platform-india.md?raw";
import blog17Raw from "../../blogs/blog-17-dropshipping-india.md?raw";
import blog18Raw from "../../blogs/blog-18-upi-cod-razorpay-ecommerce-india.md?raw";
import blog19Raw from "../../blogs/blog-19-ecommerce-for-housewife-local-shop-india.md?raw";
import blog20Raw from "../../blogs/blog-20-ecommerce-affiliate-helper-program-india.md?raw";
import blog21Raw from "../../blogs/blog-21-ecommerce-india-faq.md?raw";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  rawContent: string;
}

// Strip YAML frontmatter and return just the markdown body
function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("---", 3);
  if (end === -1) return raw;
  return raw.slice(end + 3).trim();
}

// Extract a frontmatter field value
function getFrontmatterField(raw: string, field: string): string {
  const regex = new RegExp(`^${field}:\\s*["']?(.+?)["']?\\s*$`, "m");
  const match = raw.match(regex);
  return match ? match[1].trim() : "";
}

function makeBlogPost(
  slug: string,
  raw: string,
  fallbackTitle: string,
  fallbackDescription: string,
  fallbackDate: string
): BlogPost {
  const title =
    getFrontmatterField(raw, "title") ||
    getFrontmatterField(raw, "meta_title") ||
    fallbackTitle;
  const description =
    getFrontmatterField(raw, "meta_description") || fallbackDescription;
  const date = getFrontmatterField(raw, "date") || fallbackDate;
  const author =
    getFrontmatterField(raw, "author") || "DigitalDukandar Team";

  return { slug, title, description, date, author, rawContent: raw };
}

export const blogPosts: BlogPost[] = [
  makeBlogPost(
    "best-ecommerce-website-builder",
    blog1Raw,
    "Which Website Builder Is Best for Ecommerce? (2026 Guide for Indian Sellers)",
    "Compare Shopify, Wix, WooCommerce & DigitalDukandar for Indian sellers. Find the best free option.",
    "2026-04-06"
  ),
  makeBlogPost(
    "wix-vs-wordpress-ecommerce",
    blog2Raw,
    "Is Wix or WordPress Better for eCommerce? (Honest Answer for Indian Sellers)",
    "Comparing Wix vs WordPress WooCommerce for ecommerce in India. Pricing, UPI, COD, Shiprocket breakdown.",
    "2026-04-06"
  ),
  makeBlogPost(
    "do-i-need-llc-ecommerce-india",
    blog3Raw,
    "Do You Need to Register a Company to Sell Online in India?",
    "Learn when you need Pvt Ltd, LLP, or sole proprietorship for ecommerce in India — and when you don't.",
    "2026-04-06"
  ),
  makeBlogPost(
    "cheapest-ecommerce-website-builder",
    blog4Raw,
    "Cheapest Ecommerce Website Builder in India (2026) — Free Options Compared",
    "Compare the real total cost of Shopify, Wix, Dukaan, WooCommerce, and DigitalDukandar.",
    "2026-04-06"
  ),
  makeBlogPost(
    "is-wix-free-forever",
    blog5Raw,
    "Is Wix Really Free Forever? The Honest Truth (+ Free Alternative for India)",
    "Yes, Wix has a free plan — but you cannot sell products on it. See Wix's real limitations.",
    "2026-04-06"
  ),
  makeBlogPost(
    "cheaper-option-than-wix",
    blog6Raw,
    "Is There a Cheaper Option Than Wix? Yes — And It's Free for Indian Sellers",
    "Wix costs up to ₹2,000/month with no UPI or COD. Discover the best free Wix alternatives for Indian sellers.",
    "2026-04-06"
  ),
  makeBlogPost(
    "100-percent-free-website-builder",
    blog7Raw,
    "Is There a 100% Free Website Builder? Yes — Here's What 'Free' Actually Means",
    "Most 'free' website builders hide limits. This guide breaks down what free really means for Indian sellers.",
    "2026-04-06"
  ),
  makeBlogPost(
    "types-of-ecommerce",
    blog8Raw,
    "How Many Types of E-Commerce Are There? All 6 Models Explained (2025)",
    "Learn all 6 types of e-commerce — B2C, B2B, C2C, D2C, B2G, C2B — with India examples.",
    "2026-04-06"
  ),
  makeBlogPost(
    "shopify-alternative-india",
    blog9Raw,
    "Best Shopify Alternative in India 2026 — Free, No Transaction Fees, UPI & WhatsApp",
    "Looking for the best Shopify alternative in India? Compare free options with UPI, COD, WhatsApp integration and 0% transaction fees. Save ₹20,000+ per year vs Shopify.",
    "2026-04-26"
  ),
  makeBlogPost(
    "whatsapp-store-india",
    blog10Raw,
    "WhatsApp Store India 2026 — How to Sell on WhatsApp & Receive Orders",
    "Learn how to create a WhatsApp store in India, receive orders on WhatsApp Business, and automate your ecommerce with WhatsApp integration. Free setup guide.",
    "2026-04-26"
  ),
  makeBlogPost(
    "how-to-sell-online-india",
    blog11Raw,
    "How to Sell Online in India 2026 — Complete Free Guide for Beginners",
    "Step-by-step guide on how to sell online in India for free in 2026. Sell clothes, jewellery, handmade products, digital products and more. Zero investment needed.",
    "2026-04-26"
  ),
  makeBlogPost(
    "no-code-ecommerce-builder-india",
    blog12Raw,
    "No-Code Ecommerce Website Builder India 2026 — Build a Store Without Coding",
    "Create a professional ecommerce website in India without any coding in 2026. AI-powered no-code store builder with UPI, WhatsApp, COD and free plan. Launch in 5 minutes.",
    "2026-04-26"
  ),
  makeBlogPost(
    "online-dukan-kaise-banaye",
    blog13Raw,
    "Free Online Dukan Kaise Banaye 2026 — Bina Coding Ke Online Store Banao",
    "Free online dukan kaise banaye — step-by-step Hindi guide. Bina coding ke apni online dukan khole. UPI, WhatsApp aur COD ke saath free ecommerce website banao India mein.",
    "2026-04-26"
  ),
  makeBlogPost(
    "free-ecommerce-website-builder-india",
    blog14Raw,
    "Free Ecommerce Website Builder India 2026 — Build Your Online Store for Free",
    "Best free ecommerce website builder in India 2026. Build a professional online store for free with UPI, COD, WhatsApp and AI designer. No credit card required.",
    "2026-04-26"
  ),
  makeBlogPost(
    "online-store-builder-india",
    blog15Raw,
    "Online Store Builder India 2026 — Create Your Online Store in Minutes",
    "Best online store builder in India 2026. Create your online store for free with UPI, COD, WhatsApp and AI design. No coding. Launch in 5 minutes. Free plan available.",
    "2026-04-26"
  ),
  makeBlogPost(
    "best-ecommerce-platform-india",
    blog16Raw,
    "Best Ecommerce Platform India 2026 — Top Platforms Compared for Indian Sellers",
    "Which is the best ecommerce platform in India in 2026? Compare Shopify, Dukaan, Instamojo, WooCommerce and DigitalDukandar. Free options with UPI, COD and 0% fees.",
    "2026-04-26"
  ),
  makeBlogPost(
    "dropshipping-india",
    blog17Raw,
    "Dropshipping India 2026 — How to Start Dropshipping Business Free",
    "How to start dropshipping in India in 2026 for free. Best dropshipping platform India with UPI, COD, Shiprocket and 0% fees. Zero investment dropshipping guide.",
    "2026-04-26"
  ),
  makeBlogPost(
    "upi-cod-razorpay-ecommerce-india",
    blog18Raw,
    "UPI, COD, Razorpay & Shiprocket Ecommerce India 2026 — Complete Payments Guide",
    "How to accept UPI, Razorpay, COD and Paytm payments on your online store in India. 0% transaction fee ecommerce platform with Shiprocket shipping. Free setup guide.",
    "2026-04-26"
  ),
  makeBlogPost(
    "ecommerce-for-housewife-local-shop-india",
    blog19Raw,
    "Ecommerce for Housewife, Local Shop & Side Income India 2026 — Free Guide",
    "Start an online store from home in India. Ecommerce guide for housewives, local shop owners, resellers and side income seekers. Free store, no investment, earn from home.",
    "2026-04-26"
  ),
  makeBlogPost(
    "ecommerce-affiliate-helper-program-india",
    blog20Raw,
    "Earn Commission as an Ecommerce Helper in India 2026 — Affiliate & Referral Program",
    "Earn commission by helping Indian businesses go online. Join DigitalDukandar's helper program — 10% direct commission + 5% network commission. Work from home ecommerce agent India.",
    "2026-04-26"
  ),
  makeBlogPost(
    "ecommerce-india-faq",
    blog21Raw,
    "Ecommerce India FAQ 2026 — 25 Most Asked Questions Answered",
    "Answers to India's most asked ecommerce questions in 2026. GST, company registration, UPI payments, Shopify cost in India, dropshipping, ranking on Google and more.",
    "2026-04-26"
  ),
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function getBodyContent(post: BlogPost): string {
  const body = stripFrontmatter(post.rawContent);
  // Strip editorial metadata sections (not meant for readers)
  const cutMarker = body.indexOf("\n## Content Package");
  if (cutMarker !== -1) return body.slice(0, cutMarker).trim();
  return body;
}
