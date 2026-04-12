import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Calendar, User, ArrowRight, TrendingUp, IndianRupee, BookOpen } from "lucide-react";
import { blogPosts } from "@/data/blogPosts";

const blogListSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  "name": "DigitalDukandar Blog",
  "description": "Ecommerce guides, platform comparisons, and selling tips for Indian entrepreneurs and small businesses.",
  "url": "https://digitaldukandar.in/blog",
  "inLanguage": "en-IN",
  "publisher": {
    "@type": "Organization",
    "name": "DigitalDukandar",
    "url": "https://digitaldukandar.in"
  },
  "audience": {
    "@type": "Audience",
    "geographicArea": { "@type": "Country", "name": "India" }
  }
};

const Blog = () => {
  const featured = blogPosts[0];
  const rest = blogPosts.slice(1);

  return (
    <>
      <Helmet>
        <title>Blog — DigitalDukandar | Ecommerce Tips for Indian Sellers</title>
        <meta name="description" content="Guides, comparisons, and tips for Indian sellers. Learn how to start your online store, compare platforms, and grow your ecommerce business in India." />
        <meta name="robots" content="index, follow" />
        <meta name="geo.region" content="IN" />
        <meta name="geo.placename" content="India" />
        <meta name="language" content="en-IN" />
        <meta property="og:title" content="Blog — DigitalDukandar | Ecommerce Tips for Indian Sellers" />
        <meta property="og:description" content="Guides, comparisons, and tips for Indian sellers. Learn how to start your online store, compare platforms, and grow your ecommerce business." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://digitaldukandar.in/blog" />
        <link rel="canonical" href="https://digitaldukandar.in/blog" />
        <script type="application/ld+json">{JSON.stringify(blogListSchema)}</script>
      </Helmet>

      <div className="min-h-screen bg-background">

        {/* Hero Header */}
        <div className="bg-gradient-to-br from-primary/10 via-background to-muted/20 border-b border-border">
          <div className="container mx-auto px-4 py-14">
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors mb-6 inline-flex items-center gap-1">
              ← Home
            </Link>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-full px-3 py-1 text-xs font-medium">
                <IndianRupee className="w-3 h-3" />
                Made for India
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-foreground mb-3">
              Ecommerce Blog
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl">
              Honest guides for Indian entrepreneurs — platform comparisons, cost breakdowns, and how to start selling online for free.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6 mt-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                {blogPosts.length} articles
              </span>
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                India-focused
              </span>
              <span className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-primary" />
                Free to read
              </span>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">

          {/* Featured Post */}
          {featured && (
            <div className="mb-12">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">Featured Post</p>
              <Link
                to={`/blog/${featured.slug}`}
                className="group block bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:border-primary/40 transition-all duration-300"
              >
                <div className="bg-gradient-to-br from-primary/10 to-muted/30 p-8 md:p-10">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="bg-primary/10 text-primary text-xs font-medium px-3 py-1 rounded-full border border-primary/20">
                      India Guide
                    </span>
                    <span className="bg-muted text-muted-foreground text-xs font-medium px-3 py-1 rounded-full">
                      Platform Comparison
                    </span>
                  </div>
                  <h2 className="text-xl md:text-3xl font-bold text-foreground group-hover:text-primary transition-colors leading-tight mb-3">
                    {featured.title}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed mb-6 max-w-2xl">
                    {featured.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        {featured.author}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(featured.date).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-primary font-medium text-sm group-hover:gap-3 transition-all">
                      Read article <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* All Posts Grid */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-6">All Articles</p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group flex flex-col bg-card border border-border rounded-2xl p-6 hover:shadow-lg hover:border-primary/40 transition-all duration-300"
              >
                <div className="flex-1">
                  <span className="inline-block bg-primary/8 text-primary text-xs font-medium px-2.5 py-1 rounded-full border border-primary/15 mb-3">
                    India Guide
                  </span>
                  <h2 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors leading-snug mb-3">
                    {post.title}
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
                    {post.description}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-5 pt-4 border-t border-border">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-primary" />
                </div>
              </Link>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 bg-gradient-to-br from-primary/10 to-muted/20 border border-primary/20 rounded-2xl p-10 text-center">
            <h3 className="text-2xl font-bold text-foreground mb-2">
              Ready to sell online in India?
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Free store with UPI payments, WhatsApp orders, Shiprocket shipping &amp; COD — no credit card needed.
            </p>
            <Link
              to="/auth"
              className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 text-sm"
            >
              Create Free Store →
            </Link>
          </div>

        </div>
      </div>
    </>
  );
};

export default Blog;
