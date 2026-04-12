import blog1Raw from "../../blogs/blog-1-best-ecommerce-website-builder.md?raw";
import blog2Raw from "../../blogs/blog-2-wix-vs-wordpress-ecommerce.md?raw";
import blog3Raw from "../../blogs/blog-3-do-i-need-llc-ecommerce-india.md?raw";
import blog4Raw from "../../blogs/blog-4-cheapest-ecommerce-website-builder.md?raw";
import blog5Raw from "../../blogs/blog-5-is-wix-free-forever.md?raw";
import blog6Raw from "../../blogs/blog-6-cheaper-option-than-wix.md?raw";
import blog7Raw from "../../blogs/blog-7-100-percent-free-website-builder.md?raw";
import blog8Raw from "../../blogs/blog-8-types-of-ecommerce.md?raw";

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
