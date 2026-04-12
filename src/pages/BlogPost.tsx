import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Calendar, User, ArrowLeft, Clock, ChevronRight, CheckCircle2, AlertCircle, TrendingUp, IndianRupee } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getBlogPost, getBodyContent, blogPosts } from "@/data/blogPosts";
import type { Components } from "react-markdown";

// Estimate reading time
function readingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

// Extract H2 headings for Table of Contents
function extractTOC(body: string): { id: string; text: string }[] {
  const lines = body.split("\n");
  return lines
    .filter((l) => l.startsWith("## "))
    .map((l) => {
      const text = l.replace(/^##\s+/, "");
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return { id, text };
    });
}

// Build Article JSON-LD schema
function buildArticleSchema(post: { title: string; description: string; date: string; author: string; slug: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.description,
    "datePublished": post.date,
    "dateModified": post.date,
    "author": { "@type": "Organization", "name": post.author },
    "publisher": {
      "@type": "Organization",
      "name": "DigitalDukandar",
      "logo": { "@type": "ImageObject", "url": "https://digitaldukandar.in/logo.png" }
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": `https://digitaldukandar.in/blog/${post.slug}` },
    "inLanguage": "en-IN",
    "about": { "@type": "Thing", "name": "Ecommerce India" },
    "audience": { "@type": "Audience", "geographicArea": { "@type": "Country", "name": "India" } }
  };
}

// Build BreadcrumbList schema
function buildBreadcrumbSchema(title: string, slug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://digitaldukandar.in" },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://digitaldukandar.in/blog" },
      { "@type": "ListItem", "position": 3, "name": title, "item": `https://digitaldukandar.in/blog/${slug}` }
    ]
  };
}

// Custom markdown components
const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mt-2 mb-6 leading-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => {
    const text = String(children);
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return (
      <h2 id={id} className="group flex items-start gap-3 text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-20">
        <span className="mt-1 flex-shrink-0 w-1 h-7 rounded-full bg-primary" />
        {children}
      </h2>
    );
  },
  h3: ({ children }) => (
    <h3 className="text-xl font-semibold text-foreground mt-8 mb-3 flex items-center gap-2">
      <span className="w-5 h-0.5 bg-primary/60 rounded-full flex-shrink-0" />
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-muted-foreground leading-7 mb-5 text-base">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
      className="text-primary font-medium underline underline-offset-4 hover:opacity-80 transition-opacity">
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="my-4 space-y-2 pl-0 list-none">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 space-y-2 pl-0 list-none counter-reset-item">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="flex items-start gap-2.5 text-muted-foreground text-base leading-relaxed">
      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
      <span>{children}</span>
    </li>
  ),
  blockquote: ({ children }) => (
    <div className="my-6 flex gap-3 bg-primary/5 border border-primary/20 rounded-xl p-4">
      <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
      <div className="text-foreground text-sm leading-relaxed">{children}</div>
    </div>
  ),
  hr: () => (
    <div className="my-10 flex items-center gap-4">
      <div className="flex-1 h-px bg-border" />
      <div className="w-2 h-2 rounded-full bg-primary/40" />
      <div className="flex-1 h-px bg-border" />
    </div>
  ),
  table: ({ children }) => (
    <div className="my-8 overflow-x-auto rounded-xl border border-border shadow-sm">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-primary text-primary-foreground">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border">{children}</tbody>
  ),
  th: ({ children }) => (
    <th className="px-4 py-3 text-left font-semibold text-sm whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => {
    const text = String(children);
    const isYes = text === "Yes" || text.startsWith("Yes —");
    const isNo = text === "No" || text.startsWith("No —") || text.startsWith("No.");
    return (
      <td className={`px-4 py-3 text-sm ${isYes ? "text-green-600 dark:text-green-400 font-medium" : isNo ? "text-red-500 dark:text-red-400" : "text-muted-foreground"}`}>
        {children}
      </td>
    );
  },
  tr: ({ children }) => (
    <tr className="odd:bg-muted/20 hover:bg-muted/40 transition-colors">{children}</tr>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <pre className="my-6 overflow-x-auto rounded-xl bg-muted border border-border p-4 text-sm font-mono text-foreground">
          <code>{children}</code>
        </pre>
      );
    }
    return (
      <code className="bg-muted border border-border text-primary rounded px-1.5 py-0.5 text-sm font-mono">
        {children}
      </code>
    );
  },
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPost(slug) : undefined;

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">Post not found</h1>
        <Link to="/blog" className="text-primary hover:underline">← Back to Blog</Link>
      </div>
    );
  }

  const body = getBodyContent(post);
  const mins = readingTime(body);
  const toc = extractTOC(body);
  const related = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 3);

  const articleSchema = buildArticleSchema(post);
  const breadcrumbSchema = buildBreadcrumbSchema(post.title, post.slug);

  return (
    <>
      <Helmet>
        <title>{post.title} | DigitalDukandar Blog</title>
        <meta name="description" content={post.description} />
        <meta name="robots" content="index, follow" />
        <meta name="geo.region" content="IN" />
        <meta name="geo.placename" content="India" />
        <meta name="language" content="en-IN" />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://digitaldukandar.in/blog/${post.slug}`} />
        <meta property="og:site_name" content="DigitalDukandar" />
        <meta property="article:published_time" content={post.date} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.description} />
        <link rel="canonical" href={`https://digitaldukandar.in/blog/${post.slug}`} />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <div className="min-h-screen bg-background">

        {/* Breadcrumb */}
        <div className="border-b border-border bg-muted/20">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-primary transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <Link to="/blog" className="hover:text-primary transition-colors">Blog</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground line-clamp-1 max-w-[200px]">{post.title}</span>
            </div>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="bg-gradient-to-br from-primary/10 via-background to-muted/30 border-b border-border">
          <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" />
              All Posts
            </Link>

            {/* Geo badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-full px-3 py-1 text-xs font-medium">
                <IndianRupee className="w-3 h-3" />
                India Guide
              </span>
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-xs font-medium">
                <TrendingUp className="w-3 h-3" />
                Ecommerce
              </span>
            </div>

            <h1 className="text-2xl md:text-4xl font-extrabold text-foreground leading-tight mb-4">
              {post.title}
            </h1>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed mb-6 max-w-2xl">
              {post.description}
            </p>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-primary" />
                {post.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                {new Date(post.date).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                {mins} min read
              </span>
            </div>
          </div>
        </div>

        {/* Body + Sidebar */}
        <div className="container mx-auto px-4 py-10 max-w-6xl">
          <div className="flex flex-col lg:flex-row gap-10">

            {/* Article content */}
            <article className="flex-1 min-w-0">
              <ReactMarkdown components={mdComponents}>{body}</ReactMarkdown>

              {/* Footer CTA */}
              <div className="mt-14 p-8 bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/25 rounded-2xl text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Start your free Indian online store today
                </h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                  UPI payments, WhatsApp orders, Shiprocket shipping, COD support — free forever. No credit card needed.
                </p>
                <Link
                  to="/auth"
                  className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity text-sm shadow-lg shadow-primary/25"
                >
                  Get Started Free →
                </Link>
              </div>

              {/* Back link */}
              <div className="mt-8 text-center">
                <Link to="/blog" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  ← Back to all posts
                </Link>
              </div>
            </article>

            {/* Sticky Sidebar */}
            <aside className="lg:w-72 flex-shrink-0">
              <div className="lg:sticky lg:top-6 space-y-6">

                {/* Table of Contents */}
                {toc.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <span className="w-4 h-4 bg-primary/10 rounded flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </span>
                      In this article
                    </h4>
                    <nav className="space-y-1">
                      {toc.map((item) => (
                        <a
                          key={item.id}
                          href={`#${item.id}`}
                          className="block text-xs text-muted-foreground hover:text-primary transition-colors py-1.5 pl-3 border-l-2 border-transparent hover:border-primary leading-snug"
                        >
                          {item.text}
                        </a>
                      ))}
                    </nav>
                  </div>
                )}

                {/* Quick Facts box */}
                <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-5">
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-orange-500" />
                    India Quick Facts
                  </h4>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      UPI is India's #1 payment method
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      COD preferred in Tier 2 &amp; 3 cities
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      WhatsApp used by 500M+ Indians
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      Shiprocket covers 27,000+ pin codes
                    </li>
                  </ul>
                </div>

                {/* Related posts */}
                {related.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h4 className="text-sm font-semibold text-foreground mb-3">Related Posts</h4>
                    <div className="space-y-3">
                      {related.map((r) => (
                        <Link
                          key={r.slug}
                          to={`/blog/${r.slug}`}
                          className="block text-xs text-muted-foreground hover:text-primary transition-colors leading-snug py-2 border-b border-border last:border-0"
                        >
                          {r.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
};

export default BlogPost;
