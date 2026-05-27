import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/customer/Header";
import StoreFooter from "@/components/customer/StoreFooter";
import WhatsAppFloat from "@/components/customer/WhatsAppFloat";
import {
  BookOpen, Users, Star, ArrowRight, CheckCircle,
  Clock, BarChart2, Trophy, Zap, ChevronRight,
} from "lucide-react";
import type { StoreContextData, StoreProfileData } from "@/contexts/StoreContext";
import type { Product } from "@/lib/productData";
import { isStoreSpecificDomain } from "@/lib/domainUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  image_url?: string | null;
  store_id: string;
}

export interface PlayfulStorefrontProps {
  store: StoreContextData & {
    policies?: Record<string, string | null> | null;
    social_links?: Record<string, string | null> | null;
    google_reviews_enabled?: boolean | null;
    instagram_reels_settings?: unknown;
    instagram_username?: string | null;
  };
  profile: StoreProfileData | null;
  products: Product[];
  categories: Category[];
}

// ─── Static demo data (no DB needed) ─────────────────────────────────────────

const TESTIMONIALS = [
  {
    name: "Priya Sharma",
    role: "UI Designer",
    avatar: "PS",
    avatarBg: "bg-violet-500",
    rating: 5,
    text: "The courses completely transformed how I work. Structured, practical, and genuinely fun to follow.",
  },
  {
    name: "Rahul Mehta",
    role: "Frontend Developer",
    avatar: "RM",
    avatarBg: "bg-orange-500",
    rating: 5,
    text: "I went from zero to landing my first freelance client in 6 weeks. The progress tracking kept me accountable.",
  },
  {
    name: "Aisha Khan",
    role: "Product Manager",
    avatar: "AK",
    avatarBg: "bg-green-500",
    rating: 5,
    text: "Best investment I made this year. The community and live feedback sessions are priceless.",
  },
];

const PROGRESS_TRACKS = [
  { label: "Web Fundamentals", pct: 92, color: "bg-violet-500" },
  { label: "UI/UX Design",     pct: 74, color: "bg-orange-400" },
  { label: "JavaScript",       pct: 61, color: "bg-green-500"  },
  { label: "React & Next.js",  pct: 43, color: "bg-sky-500"    },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ClayCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-[1.25rem] border-2 border-[hsl(var(--border))] ${className}`}
      style={{ boxShadow: "var(--shadow-card, 4px 4px 0px rgba(79,70,229,0.15), inset -2px -2px 8px rgba(79,70,229,0.08))" }}
    >
      {children}
    </div>
  );
}

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const PlayfulStorefront = ({ store, profile, products, categories }: PlayfulStorefrontProps) => {
  const isSubdomain = isStoreSpecificDomain();
  const productsLink = isSubdomain ? "/products" : `/${store.slug}/products`;

  const publishedProducts = products.filter(p => (p as any).status === "published");
  const courseCount  = publishedProducts.length;
  const studentCount = Math.max(courseCount * 47 + 128, 500); // deterministic fun number

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background,226_100%_97%))]">
      <Header storeId={store.id} storeSlug={store.slug} />

      <main className="flex-1">

        {/* ═══ HERO ═══════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden py-20 md:py-28">
          {/* Blob decorations */}
          <div className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full bg-violet-200/60 blur-3xl" />
          <div className="pointer-events-none absolute top-10 -right-16 w-64 h-64 rounded-full bg-orange-200/50 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/2 w-80 h-40 rounded-full bg-green-200/40 blur-3xl" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              {/* Logo */}
              {store.logo_url && (
                <img
                  src={store.logo_url}
                  alt={store.name}
                  className="h-16 w-auto mx-auto mb-6 object-contain"
                />
              )}

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 border-2 border-violet-200 text-violet-700 text-sm font-semibold mb-6">
                <Zap className="w-4 h-4" />
                Learn. Build. Grow.
              </div>

              {/* Headline */}
              <h1 className="text-5xl md:text-6xl font-bold text-[hsl(var(--foreground,244_47%_20%))] leading-tight mb-6">
                {store.name}
              </h1>

              {/* Sub */}
              <p className="text-xl text-[hsl(var(--muted-foreground,244_20%_46%))] max-w-xl mx-auto mb-10 leading-relaxed">
                {store.description || "Unlock new skills with expert-led courses designed to get you results fast."}
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to={productsLink}>
                  <Button
                    size="lg"
                    className="text-base px-8 h-14 rounded-2xl font-semibold shadow-[4px_4px_0px_rgba(79,70,229,0.3)] hover:shadow-[2px_2px_0px_rgba(79,70,229,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200"
                  >
                    Browse Courses
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base px-8 h-14 rounded-2xl font-semibold border-2"
                >
                  See How It Works
                </Button>
              </div>
            </div>

            {/* Stats bar */}
            <div className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              {[
                { icon: BookOpen, value: `${courseCount}+`,       label: "Courses" },
                { icon: Users,    value: `${studentCount}+`,      label: "Students" },
                { icon: Trophy,   value: `${categories.length}+`, label: "Categories" },
              ].map(({ icon: Icon, value, label }) => (
                <ClayCard key={label} className="flex flex-col items-center gap-1 py-5 px-3">
                  <Icon className="w-6 h-6 text-[hsl(var(--primary,243_75%_59%))] mb-1" />
                  <span className="text-2xl font-bold text-[hsl(var(--foreground,244_47%_20%))]">{value}</span>
                  <span className="text-sm text-[hsl(var(--muted-foreground,244_20%_46%))]">{label}</span>
                </ClayCard>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ COURSE CATALOG ══════════════════════════════════════════════════ */}
        <section className="py-20 bg-white/60">
          <div className="container mx-auto px-4">
            <div className="flex items-end justify-between mb-10">
              <div>
                <Badge className="mb-3 bg-violet-100 text-violet-700 border-0 font-semibold">All Courses</Badge>
                <h2 className="text-4xl font-bold text-[hsl(var(--foreground,244_47%_20%))]">
                  What You'll Learn
                </h2>
                <p className="text-[hsl(var(--muted-foreground,244_20%_46%))] mt-2 text-lg">
                  Practical skills taught by real practitioners
                </p>
              </div>
              <Link to={productsLink} className="hidden sm:flex items-center gap-1 text-[hsl(var(--primary,243_75%_59%))] font-semibold hover:gap-2 transition-all">
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {publishedProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {publishedProducts.slice(0, 8).map((product) => {
                  const p = product as any;
                  const thumb = p.images?.[0] || null;
                  const price = p.offer_price ?? p.base_price ?? null;
                  const isOutOfStock = p.stock === 0;

                  return (
                    <Link key={p.id} to={isSubdomain ? `/products/${p.slug}` : `/${store.slug}/products/${p.slug}`}>
                      <ClayCard className="overflow-hidden group hover:translate-y-[-4px] transition-transform duration-200 h-full flex flex-col">
                        {/* Thumbnail */}
                        <div className="aspect-video bg-gradient-to-br from-violet-100 to-indigo-100 relative overflow-hidden">
                          {thumb ? (
                            <img src={thumb} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="w-10 h-10 text-violet-300" />
                            </div>
                          )}
                          {/* Category pill */}
                          {p.category && (
                            <span className="absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/90 border border-violet-200 text-violet-700">
                              {p.category}
                            </span>
                          )}
                          {isOutOfStock && (
                            <span className="absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-600 text-white">
                              Out of Stock
                            </span>
                          )}
                        </div>

                        {/* Body */}
                        <div className="p-5 flex flex-col flex-1">
                          <h3 className="font-bold text-[hsl(var(--foreground,244_47%_20%))] text-base leading-snug mb-2 line-clamp-2">
                            {p.name}
                          </h3>

                          <div className="flex items-center gap-1 mb-4">
                            <StarRating count={5} />
                            <span className="text-xs text-[hsl(var(--muted-foreground))] ml-1">(new)</span>
                          </div>

                          <div className="mt-auto flex items-center justify-between">
                            {price != null ? (
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-lg font-bold text-[hsl(var(--foreground,244_47%_20%))]">
                                  ₹{Number(price).toLocaleString()}
                                </span>
                                {p.base_price && p.offer_price && p.offer_price < p.base_price && (
                                  <span className="text-sm text-[hsl(var(--muted-foreground))] line-through">
                                    ₹{Number(p.base_price).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm font-semibold text-green-600">Free</span>
                            )}
                            <span className={`text-xs font-semibold px-3 py-1.5 rounded-xl ${isOutOfStock ? "bg-slate-200 text-slate-600" : "bg-[hsl(var(--primary,243_75%_59%))] text-white"}`}>
                              {isOutOfStock ? "Out of Stock" : "Enroll"}
                            </span>
                          </div>
                        </div>
                      </ClayCard>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <ClayCard className="py-16 text-center">
                <BookOpen className="w-12 h-12 text-violet-300 mx-auto mb-4" />
                <p className="text-[hsl(var(--muted-foreground))] text-lg">Courses coming soon — check back shortly.</p>
              </ClayCard>
            )}

            {publishedProducts.length > 8 && (
              <div className="text-center mt-10">
                <Link to={productsLink}>
                  <Button variant="outline" size="lg" className="rounded-2xl border-2 font-semibold px-8">
                    View All {publishedProducts.length} Courses <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ═══ PROGRESS TRACKING DEMO ══════════════════════════════════════════ */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
              {/* Copy */}
              <div>
                <Badge className="mb-4 bg-orange-100 text-orange-700 border-0 font-semibold">Track Your Growth</Badge>
                <h2 className="text-4xl font-bold text-[hsl(var(--foreground,244_47%_20%))] mb-4">
                  See Exactly How Far You've Come
                </h2>
                <p className="text-[hsl(var(--muted-foreground,244_20%_46%))] text-lg mb-8 leading-relaxed">
                  Real-time dashboards keep you on track. Watch skills level up as you complete each module.
                </p>
                <ul className="space-y-3">
                  {["Visual progress per course", "Milestone badges & certificates", "Streak tracking to build habits"].map(item => (
                    <li key={item} className="flex items-center gap-3 text-[hsl(var(--foreground,244_47%_20%))] font-medium">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Demo card */}
              <ClayCard className="p-6 space-y-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center text-white font-bold text-sm">
                      YO
                    </div>
                    <div>
                      <p className="font-bold text-[hsl(var(--foreground,244_47%_20%))] text-sm">Your Progress</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">4 tracks active</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-0 text-xs font-semibold">
                    <BarChart2 className="w-3 h-3 mr-1" /> On Track
                  </Badge>
                </div>

                {PROGRESS_TRACKS.map(({ label, pct, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm font-medium mb-1.5">
                      <span className="text-[hsl(var(--foreground,244_47%_20%))]">{label}</span>
                      <span className="text-[hsl(var(--muted-foreground))]">{pct}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <Clock className="w-3.5 h-3.5" />
                  Last activity 2 hours ago
                </div>
              </ClayCard>
            </div>
          </div>
        </section>

        {/* ═══ TESTIMONIALS ════════════════════════════════════════════════════ */}
        <section className="py-20 bg-white/60">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-green-100 text-green-700 border-0 font-semibold">Student Stories</Badge>
              <h2 className="text-4xl font-bold text-[hsl(var(--foreground,244_47%_20%))]">
                Loved by Learners
              </h2>
              <p className="text-[hsl(var(--muted-foreground,244_20%_46%))] mt-3 text-lg">
                Real results from real students
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {TESTIMONIALS.map(({ name, role, avatar, avatarBg, rating, text }) => (
                <ClayCard key={name} className="p-6 flex flex-col gap-4">
                  <StarRating count={rating} />
                  <p className="text-[hsl(var(--foreground,244_47%_20%))] leading-relaxed flex-1">
                    "{text}"
                  </p>
                  <div className="flex items-center gap-3 pt-2 border-t border-[hsl(var(--border))]">
                    <div className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                      {avatar}
                    </div>
                    <div>
                      <p className="font-bold text-[hsl(var(--foreground,244_47%_20%))] text-sm">{name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{role}</p>
                    </div>
                  </div>
                </ClayCard>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ ENROLLMENT CTA ══════════════════════════════════════════════════ */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div
              className="relative overflow-hidden rounded-[2rem] border-2 border-violet-200 p-12 text-center"
              style={{ background: "linear-gradient(135deg, hsl(243,75%,59%) 0%, hsl(263,70%,57%) 50%, hsl(21,90%,48%) 100%)", boxShadow: "6px 6px 0px rgba(79,70,229,0.25), inset -3px -3px 12px rgba(79,70,229,0.1)" }}
            >
              {/* Blobs */}
              <div className="pointer-events-none absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-8 -left-8 w-48 h-48 rounded-full bg-white/10 blur-2xl" />

              <div className="relative z-10">
                <Badge className="mb-6 bg-white/20 text-white border-white/30 font-semibold text-sm px-4 py-1.5">
                  Start Today — No Risk
                </Badge>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                  Ready to Level Up?
                </h2>
                <p className="text-white/80 text-xl mb-10 max-w-lg mx-auto leading-relaxed">
                  Join {studentCount.toLocaleString()}+ students already building real skills at {store.name}.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to={productsLink}>
                    <Button
                      size="lg"
                      className="bg-white text-[hsl(243,75%,59%)] hover:bg-white/90 text-base px-10 h-14 rounded-2xl font-bold shadow-[4px_4px_0px_rgba(0,0,0,0.15)] hover:shadow-[2px_2px_0px_rgba(0,0,0,0.15)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200"
                    >
                      Browse All Courses
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      <StoreFooter
        storeName={store.name}
        storeDescription={store.description}
        whatsappNumber={store.whatsapp_number}
        phone={profile?.phone}
        email={profile?.email}
        address={store.address}
        facebookUrl={store.facebook_url}
        instagramUrl={store.instagram_url}
        twitterUrl={store.twitter_url}
        youtubeUrl={store.youtube_url}
        linkedinUrl={store.linkedin_url}
        socialLinks={store.social_links as any}
        policies={store.policies as any}
      />

      {store.whatsapp_float_enabled !== false && store.whatsapp_number && (
        <WhatsAppFloat storeId={store.id} />
      )}
    </div>
  );
};

export default PlayfulStorefront;
