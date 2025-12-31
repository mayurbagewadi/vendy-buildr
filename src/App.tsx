import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import WhatsAppFloat from "@/components/customer/WhatsAppFloat";
import { ScrollToTop } from "@/components/ScrollToTop";
import { detectDomain, getStoreIdentifier } from "@/lib/domainUtils";
import Index from "./pages/Index";
import ConceptLanding from "./pages/concept/ConceptLanding";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminSettings from "./pages/admin/Settings";
import Products from "./pages/admin/Products";
import AddProduct from "./pages/admin/AddProduct";
import EditProduct from "./pages/admin/EditProduct";
import Orders from "./pages/admin/Orders";
import Analytics from "./pages/admin/Analytics";
import Categories from "./pages/admin/Categories";
import Subscription from "./pages/admin/Subscription";
import GrowthSEO from "./pages/admin/growth/SEO";
import GrowthSocialMedia from "./pages/admin/growth/SocialMedia";
import Home from "./pages/customer/Home";
import CustomerProducts from "./pages/customer/Products";
import CustomerCategories from "./pages/customer/Categories";
import ProductDetail from "./pages/customer/ProductDetail";
import Cart from "./pages/customer/Cart";
import Checkout from "./pages/customer/Checkout";
import Pricing from "./pages/Pricing";
import Auth from "./pages/Auth";
import SuperAdminLogin from "./pages/superadmin/Login";
import SuperAdminDashboard from "./pages/superadmin/Dashboard";
import SuperAdminUsers from "./pages/superadmin/Users";
import HelperManagement from "./pages/superadmin/HelperManagement";
import SuperAdminCommissions from "./pages/superadmin/Commissions";
import SuperAdminCommissionSettings from "./pages/superadmin/CommissionSettings";
import SuperAdminReportsAnalytics from "./pages/superadmin/ReportsAnalytics";
import SuperAdminSubscriptionPlans from "./pages/superadmin/SubscriptionPlans";
import SuperAdminTransactions from "./pages/superadmin/Transactions";
import SuperAdminBilling from "./pages/superadmin/Billing";
import SuperAdminCustomDomains from "./pages/superadmin/CustomDomains";
import SuperAdminPlatformSettings from "./pages/superadmin/PlatformSettings";
import SuperAdminSitemapManager from "./pages/superadmin/SitemapManager";
import OnboardingStoreSetup from "./pages/onboarding/StoreSetup";
import OnboardingComplete from "./pages/onboarding/Complete";
import Store from "./pages/customer/Store";
import Policies from "./pages/customer/Policies";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import BecomeHelper from "./pages/BecomeHelper";
import ApplicationStatus from "./pages/ApplicationStatus";
import HelperDashboard from "./pages/HelperDashboard";
import MyReferrals from "./pages/MyReferrals";
import MyHelperNetwork from "./pages/MyHelperNetwork";
import CommissionHistory from "./pages/CommissionHistory";
import HelperProfile from "./pages/HelperProfile";
import HelperLogin from "./pages/HelperLogin";
import Sitemap from "./pages/Sitemap";

const queryClient = new QueryClient();

const App = () => {
  // Detect if we're on a store-specific subdomain or custom domain
  const domainInfo = detectDomain();
  const storeIdentifier = getStoreIdentifier();

  console.log('Domain Info:', domainInfo);
  console.log('Store Identifier:', storeIdentifier);

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <TooltipProvider>
            <CartProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <Routes>
                  {domainInfo.isStoreSpecific && storeIdentifier ? (
                    // SUBDOMAIN/CUSTOM DOMAIN ROUTES (e.g., storename.yesgive.shop)
                    // Store pages without /slug prefix
                    <>
                      <Route path="/" element={<Store slug={storeIdentifier} />} />
                      <Route path="/policies" element={<Policies slug={storeIdentifier} />} />
                      <Route path="/categories" element={<CustomerCategories slug={storeIdentifier} />} />
                      <Route path="/products" element={<CustomerProducts slug={storeIdentifier} />} />
                      <Route path="/products/:slug" element={<ProductDetail slug={storeIdentifier} />} />
                      <Route path="/cart" element={<Cart slug={storeIdentifier} />} />
                      <Route path="/checkout" element={<Checkout slug={storeIdentifier} />} />
                      <Route path="/sitemap.xml" element={<Sitemap />} />
                      <Route path="*" element={<NotFound />} />
                    </>
                  ) : (
                    // MAIN PLATFORM ROUTES (yesgive.shop)
                    <>
                      <Route path="/" element={<Index />} />
                      <Route path="/pricing" element={<Pricing />} />
                      <Route path="/auth" element={<Auth />} />
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

                      {/* Customer Routes */}
                      <Route path="/home" element={<Home />} />
                      <Route path="/categories" element={<CustomerCategories />} />
                      <Route path="/products" element={<CustomerProducts />} />
                      <Route path="/products/:slug" element={<ProductDetail />} />
                      <Route path="/cart" element={<Cart />} />
                      <Route path="/checkout" element={<Checkout />} />

                      {/* Admin Routes */}
                      <Route path="/admin/dashboard" element={<AdminDashboard />} />
                      <Route path="/admin/products" element={<Products />} />
                      <Route path="/admin/products/add" element={<AddProduct />} />
                      <Route path="/admin/products/edit/:id" element={<EditProduct />} />
                      <Route path="/admin/categories" element={<Categories />} />
                      <Route path="/admin/orders" element={<Orders />} />
                      <Route path="/admin/analytics" element={<Analytics />} />
                      <Route path="/admin/subscription" element={<Subscription />} />
                      <Route path="/admin/growth/seo" element={<GrowthSEO />} />
                      <Route path="/admin/growth/social-media" element={<GrowthSocialMedia />} />
                      <Route path="/admin/settings" element={<AdminSettings />} />

                      {/* Super Admin Routes */}
                      <Route path="/superadmin/login" element={<SuperAdminLogin />} />
                      <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
                      <Route path="/superadmin/users" element={<SuperAdminUsers />} />
                      <Route path="/superadmin/helpers" element={<HelperManagement />} />
                      <Route path="/superadmin/commissions" element={<SuperAdminCommissions />} />
                      <Route path="/superadmin/commission-settings" element={<SuperAdminCommissionSettings />} />
                      <Route path="/superadmin/reports-analytics" element={<SuperAdminReportsAnalytics />} />
                      <Route path="/superadmin/subscription-plans" element={<SuperAdminSubscriptionPlans />} />
                      <Route path="/superadmin/transactions" element={<SuperAdminTransactions />} />
                      <Route path="/superadmin/billing" element={<SuperAdminBilling />} />
                      <Route path="/superadmin/custom-domains" element={<SuperAdminCustomDomains />} />
                      <Route path="/superadmin/settings" element={<SuperAdminPlatformSettings />} />
                      <Route path="/superadmin/sitemaps" element={<SuperAdminSitemapManager />} />

                      {/* Concept/Prototype Routes */}
                      <Route path="/concept" element={<ConceptLanding />} />

                      {/* Onboarding Routes */}
                      <Route path="/onboarding/store-setup" element={<OnboardingStoreSetup />} />
                      <Route path="/onboarding/complete" element={<OnboardingComplete />} />

                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      {/* Dynamic Store Route - must be last before 404 */}
                      <Route path="/:slug" element={<Store />} />
                      <Route path="/:slug/policies" element={<Policies />} />
                      <Route path="/:slug/categories" element={<CustomerCategories />} />
                      <Route path="/:slug/products" element={<CustomerProducts />} />
                      <Route path="/:slug/products/:productSlug" element={<ProductDetail />} />
                      <Route path="/:slug/cart" element={<Cart />} />
                      <Route path="/:slug/checkout" element={<Checkout />} />
                      <Route path="*" element={<NotFound />} />
                    </>
                  )}
                </Routes>
              </BrowserRouter>
            </CartProvider>
          </TooltipProvider>
        </ThemeProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
};

export default App;
