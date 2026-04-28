import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import WhatsAppFloat from "@/components/customer/WhatsAppFloat";
import { ScrollToTop } from "@/components/ScrollToTop";
import { detectDomain, getStoreIdentifier } from "@/lib/domainUtils";

// Guards and layouts stay as regular imports — they are tiny wrappers needed synchronously
import { StoreGuard } from "./components/admin/StoreGuard";
import { SuperAdminGuard } from "./components/superadmin/SuperAdminGuard";
import AdminLayout from "./components/admin/AdminLayout";
import SuperAdminLayout from "./components/superadmin/SuperAdminLayout";

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────
// Each becomes a separate JS chunk — visitors only download what they navigate to.
// Landing page visitors get only the Index chunk (+ shared vendor chunks).

// Main platform pages
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Auth = lazy(() => import("./pages/Auth"));
const Guide = lazy(() => import("./pages/Guide"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const BecomeHelper = lazy(() => import("./pages/BecomeHelper"));
const ApplicationStatus = lazy(() => import("./pages/ApplicationStatus"));
const HelperLogin = lazy(() => import("./pages/HelperLogin"));
const HelperDashboard = lazy(() => import("./pages/HelperDashboard"));
const MyReferrals = lazy(() => import("./pages/MyReferrals"));
const MyHelperNetwork = lazy(() => import("./pages/MyHelperNetwork"));
const CommissionHistory = lazy(() => import("./pages/CommissionHistory"));
const HelperProfile = lazy(() => import("./pages/HelperProfile"));
const Sitemap = lazy(() => import("./pages/Sitemap"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const DeliverySettings = lazy(() => import("./pages/admin/DeliverySettings"));
const Products = lazy(() => import("./pages/admin/Products"));
const AddProduct = lazy(() => import("./pages/admin/AddProduct"));
const EditProduct = lazy(() => import("./pages/admin/EditProduct"));
const Orders = lazy(() => import("./pages/admin/Orders"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const Categories = lazy(() => import("./pages/admin/Categories"));
const Subscription = lazy(() => import("./pages/admin/Subscription"));
const GrowthSEO = lazy(() => import("./pages/admin/growth/SEO"));
const GrowthSocialMedia = lazy(() => import("./pages/admin/growth/SocialMedia"));
const GrowthInstagram = lazy(() => import("./pages/admin/growth/Instagram"));
const DiscountAndCoupon = lazy(() => import("./pages/admin/growth/DiscountAndCoupon"));
const AdminMarketplace = lazy(() => import("./pages/admin/Marketplace"));
const AdminShipping = lazy(() => import("./pages/admin/Shipping"));
const AdminAIDesigner = lazy(() => import("./pages/admin/AIDesigner"));
const BuyTokens = lazy(() => import("./pages/admin/BuyTokens"));
const AdminGoogleReviews = lazy(() => import("./pages/admin/GoogleReviews"));

// Customer pages
const Home = lazy(() => import("./pages/customer/Home"));
const CustomerProducts = lazy(() => import("./pages/customer/Products"));
const CustomerCategories = lazy(() => import("./pages/customer/Categories"));
const ProductDetail = lazy(() => import("./pages/customer/ProductDetail"));
const Cart = lazy(() => import("./pages/customer/Cart"));
const Checkout = lazy(() => import("./pages/customer/Checkout"));
const PaymentSuccess = lazy(() => import("./pages/customer/PaymentSuccess"));
const Store = lazy(() => import("./pages/customer/Store"));
const Policies = lazy(() => import("./pages/customer/Policies"));

// Superadmin pages
const SuperAdminLogin = lazy(() => import("./pages/superadmin/Login"));
const SuperAdminDashboard = lazy(() => import("./pages/superadmin/Dashboard"));
const SuperAdminUsers = lazy(() => import("./pages/superadmin/Users"));
const HelperManagement = lazy(() => import("./pages/superadmin/HelperManagement"));
const SuperAdminCommissions = lazy(() => import("./pages/superadmin/Commissions"));
const SuperAdminCommissionSettings = lazy(() => import("./pages/superadmin/CommissionSettings"));
const SuperAdminReportsAnalytics = lazy(() => import("./pages/superadmin/ReportsAnalytics"));
const SuperAdminSubscriptionPlans = lazy(() => import("./pages/superadmin/SubscriptionPlans"));
const SuperAdminTransactions = lazy(() => import("./pages/superadmin/Transactions"));
const SuperAdminBilling = lazy(() => import("./pages/superadmin/Billing"));
const SuperAdminCustomDomains = lazy(() => import("./pages/superadmin/CustomDomains"));
const SuperAdminPlatformSettings = lazy(() => import("./pages/superadmin/PlatformSettings"));
const SuperAdminSitemapManager = lazy(() => import("./pages/superadmin/SitemapManager"));
const SuperAdminMarketplace = lazy(() => import("./pages/superadmin/Marketplace"));
const SuperAdminPushNotifications = lazy(() => import("./pages/superadmin/PushNotifications"));
const AITokenPricing = lazy(() => import("./pages/superadmin/AITokenPricing"));
const AIDesignerAnalytics = lazy(() => import("./pages/superadmin/AIDesignerAnalytics"));
const SuperAdminMarketing = lazy(() => import("./pages/superadmin/Marketing"));

// Onboarding pages
const OnboardingStoreSetup = lazy(() => import("./pages/onboarding/StoreSetup"));
const OnboardingGoogleDrive = lazy(() => import("./pages/onboarding/GoogleDriveSetup"));

// ── Page loading fallback ──────────────────────────────────────────────────────
// Minimal spinner — no external imports, uses Tailwind classes already in bundle
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="w-8 h-8 border-[3px] border-muted border-t-primary rounded-full animate-spin" />
  </div>
);

// ── Third-party loaders ────────────────────────────────────────────────────────

// Load AdSense only on public-facing pages, not admin/helper routes
function AdSenseLoader() {
  const { pathname } = useLocation();
  const isPrivatePath = /^\/(admin|superadmin|helper|onboarding|checkout|cart|payment-success|auth)/.test(pathname);

  useEffect(() => {
    if (isPrivatePath) return;
    if (document.querySelector('script[src*="pagead2.googlesyndication.com"]')) return;
    const script = document.createElement('script');
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9838772035675365';
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }, [isPrivatePath]);

  return null;
}

// Load Clarity only on public/customer-facing pages — never on admin or superadmin
function ClarityAnalytics() {
  const { pathname } = useLocation();
  const isPrivatePath =
    /^\/(admin|superadmin|onboarding|home)(\/|$)/.test(pathname) ||
    /^\/helper\/(dashboard|my-referrals|my-helper-network|commission-history|profile)(\/|$)/.test(pathname);

  useEffect(() => {
    if (isPrivatePath) return;
    if ((window as any).clarity) return;
    (function (c: any, l: any, a: string, r: string, i: string) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      const t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      const y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', 'wimnj0f7x4');
  }, [isPrivatePath]);

  return null;
}

// ── App ────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient();

const App = () => {
  // Detect if we're on a store-specific subdomain or custom domain
  const domainInfo = detectDomain();
  const storeIdentifier = getStoreIdentifier();

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <TooltipProvider>
            <CartProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AdSenseLoader />
                <ClarityAnalytics />
                <ScrollToTop />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {domainInfo.isStoreSpecific && storeIdentifier ? (
                      // SUBDOMAIN/CUSTOM DOMAIN ROUTES (e.g., storename.yesgive.shop)
                      // Store pages without /slug prefix
                      <>
                        {/* Admin Routes - Protected by StoreGuard - MUST BE FIRST */}
                        <Route path="/admin/dashboard" element={<StoreGuard><AdminLayout><AdminDashboard /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/products" element={<StoreGuard><AdminLayout><Products /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/products/add" element={<StoreGuard><AdminLayout><AddProduct /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/products/edit/:id" element={<StoreGuard><AdminLayout><EditProduct /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/categories" element={<StoreGuard><AdminLayout><Categories /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/orders" element={<StoreGuard><AdminLayout><Orders /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/analytics" element={<StoreGuard><AdminLayout><Analytics /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/subscription" element={<StoreGuard><AdminLayout><Subscription /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/growth/discount-and-coupon" element={<StoreGuard><AdminLayout><DiscountAndCoupon /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/growth/seo" element={<StoreGuard><AdminLayout><GrowthSEO /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/growth/social-media" element={<StoreGuard><AdminLayout><GrowthSocialMedia /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/growth/instagram" element={<StoreGuard><AdminLayout><GrowthInstagram /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/marketplace" element={<StoreGuard><AdminLayout><AdminMarketplace /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/shipping" element={<StoreGuard><AdminLayout><AdminShipping /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/google-reviews" element={<StoreGuard><AdminLayout><AdminGoogleReviews /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/settings" element={<StoreGuard><AdminLayout><AdminSettings /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/settings/delivery" element={<StoreGuard><AdminLayout><DeliverySettings /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/ai-designer" element={<StoreGuard><AdminLayout><AdminAIDesigner /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/buy-tokens" element={<StoreGuard><AdminLayout><BuyTokens /></AdminLayout></StoreGuard>} />

                        {/* Customer Routes */}
                        <Route path="/" element={<Store slug={storeIdentifier} />} />
                        <Route path="/policies" element={<Policies slug={storeIdentifier} />} />
                        <Route path="/categories" element={<CustomerCategories slug={storeIdentifier} />} />
                        <Route path="/products" element={<CustomerProducts slug={storeIdentifier} />} />
                        <Route path="/products/:slug" element={<ProductDetail slug={storeIdentifier} />} />
                        <Route path="/cart" element={<Cart slug={storeIdentifier} />} />
                        <Route path="/checkout" element={<Checkout slug={storeIdentifier} />} />
                        <Route path="/payment-success" element={<PaymentSuccess />} />
                        <Route path="/sitemap.xml" element={<Sitemap />} />
                        <Route path="*" element={<NotFound />} />
                      </>
                    ) : (
                      // MAIN PLATFORM ROUTES (yesgive.shop)
                      <>
                        <Route path="/" element={<Index />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route path="/auth" element={<Auth />} />
                        <Route path="/guide" element={<Guide />} />
                        <Route path="/blog" element={<Blog />} />
                        <Route path="/blog/:slug" element={<BlogPost />} />
                        <Route path="/sitemap.xml" element={<Sitemap />} />
                        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                        <Route path="/terms-of-service" element={<TermsOfService />} />
                        <Route path="/become-helper" element={<BecomeHelper />} />
                        <Route path="/application-status" element={<ApplicationStatus />} />
                        <Route path="/helper/login" element={<HelperLogin />} />
                        <Route path="/helper/dashboard" element={<HelperDashboard />} />
                        <Route path="/helper/my-referrals" element={<MyReferrals />} />
                        <Route path="/helper/my-helper-network" element={<MyHelperNetwork />} />
                        <Route path="/helper/commission-history" element={<CommissionHistory />} />
                        <Route path="/helper/profile" element={<HelperProfile />} />

                        {/* Admin Routes - Protected by StoreGuard - MUST BE BEFORE CUSTOMER ROUTES */}
                        <Route path="/admin/dashboard" element={<StoreGuard><AdminLayout><AdminDashboard /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/products" element={<StoreGuard><AdminLayout><Products /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/products/add" element={<StoreGuard><AdminLayout><AddProduct /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/products/edit/:id" element={<StoreGuard><AdminLayout><EditProduct /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/categories" element={<StoreGuard><AdminLayout><Categories /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/orders" element={<StoreGuard><AdminLayout><Orders /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/analytics" element={<StoreGuard><AdminLayout><Analytics /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/subscription" element={<StoreGuard><AdminLayout><Subscription /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/growth/discount-and-coupon" element={<StoreGuard><AdminLayout><DiscountAndCoupon /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/growth/seo" element={<StoreGuard><AdminLayout><GrowthSEO /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/growth/social-media" element={<StoreGuard><AdminLayout><GrowthSocialMedia /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/growth/instagram" element={<StoreGuard><AdminLayout><GrowthInstagram /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/marketplace" element={<StoreGuard><AdminLayout><AdminMarketplace /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/shipping" element={<StoreGuard><AdminLayout><AdminShipping /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/google-reviews" element={<StoreGuard><AdminLayout><AdminGoogleReviews /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/settings" element={<StoreGuard><AdminLayout><AdminSettings /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/settings/delivery" element={<StoreGuard><AdminLayout><DeliverySettings /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/ai-designer" element={<StoreGuard><AdminLayout><AdminAIDesigner /></AdminLayout></StoreGuard>} />
                        <Route path="/admin/buy-tokens" element={<StoreGuard><AdminLayout><BuyTokens /></AdminLayout></StoreGuard>} />

                        {/* Customer Routes */}
                        <Route path="/home" element={<Home />} />
                        <Route path="/categories" element={<CustomerCategories />} />
                        <Route path="/products" element={<CustomerProducts />} />
                        <Route path="/products/:slug" element={<ProductDetail />} />
                        <Route path="/cart" element={<Cart />} />
                        <Route path="/checkout" element={<Checkout />} />
                        <Route path="/payment-success" element={<PaymentSuccess />} />

                        {/* Super Admin Routes */}
                        <Route path="/superadmin/login" element={<SuperAdminLogin />} />
                        <Route path="/superadmin" element={<SuperAdminGuard />}>
                          <Route path="dashboard" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
                          <Route path="users" element={<SuperAdminLayout><SuperAdminUsers /></SuperAdminLayout>} />
                          <Route path="helpers" element={<SuperAdminLayout><HelperManagement /></SuperAdminLayout>} />
                          <Route path="commissions" element={<SuperAdminLayout><SuperAdminCommissions /></SuperAdminLayout>} />
                          <Route path="commission-settings" element={<SuperAdminLayout><SuperAdminCommissionSettings /></SuperAdminLayout>} />
                          <Route path="reports-analytics" element={<SuperAdminLayout><SuperAdminReportsAnalytics /></SuperAdminLayout>} />
                          <Route path="subscription-plans" element={<SuperAdminLayout><SuperAdminSubscriptionPlans /></SuperAdminLayout>} />
                          <Route path="transactions" element={<SuperAdminLayout><SuperAdminTransactions /></SuperAdminLayout>} />
                          <Route path="billing" element={<SuperAdminLayout><SuperAdminBilling /></SuperAdminLayout>} />
                          <Route path="custom-domains" element={<SuperAdminLayout><SuperAdminCustomDomains /></SuperAdminLayout>} />
                          <Route path="settings" element={<SuperAdminLayout><SuperAdminPlatformSettings /></SuperAdminLayout>} />
                          <Route path="sitemaps" element={<SuperAdminLayout><SuperAdminSitemapManager /></SuperAdminLayout>} />
                          <Route path="marketplace" element={<SuperAdminLayout><SuperAdminMarketplace /></SuperAdminLayout>} />
                          <Route path="ai-token-pricing" element={<SuperAdminLayout><AITokenPricing /></SuperAdminLayout>} />
                          <Route path="ai-designer-analytics" element={<SuperAdminLayout><AIDesignerAnalytics /></SuperAdminLayout>} />
                          <Route path="marketing" element={<SuperAdminLayout><SuperAdminMarketing /></SuperAdminLayout>} />
                          <Route path="push-notifications" element={<SuperAdminLayout><SuperAdminPushNotifications /></SuperAdminLayout>} />
                        </Route>

                        {/* Onboarding Routes */}
                        <Route path="/onboarding/store-setup" element={<OnboardingStoreSetup />} />
                        <Route path="/onboarding/google-drive" element={<OnboardingGoogleDrive />} />

                        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                        {/* Dynamic Store Route - must be last before 404 */}
                        <Route path="/:slug" element={<Store />} />
                        <Route path="/:slug/policies" element={<Policies />} />
                        <Route path="/:slug/categories" element={<CustomerCategories />} />
                        <Route path="/:slug/products" element={<CustomerProducts />} />
                        <Route path="/:slug/products/:productSlug" element={<ProductDetail />} />
                        <Route path="/:slug/cart" element={<Cart />} />
                        <Route path="/:slug/checkout" element={<Checkout />} />
                        <Route path="/:slug/payment-success" element={<PaymentSuccess />} />
                        <Route path="*" element={<NotFound />} />
                      </>
                    )}
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </CartProvider>
          </TooltipProvider>
        </ThemeProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
};

export default App;
