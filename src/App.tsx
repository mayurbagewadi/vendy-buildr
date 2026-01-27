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
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminSettings from "./pages/admin/Settings";
import AdminLayout from "./components/admin/AdminLayout";
import Products from "./pages/admin/Products";
import AddProduct from "./pages/admin/AddProduct";
import EditProduct from "./pages/admin/EditProduct";
import Orders from "./pages/admin/Orders";
import Analytics from "./pages/admin/Analytics";
import Categories from "./pages/admin/Categories";
import Subscription from "./pages/admin/Subscription";
import GrowthSEO from "./pages/admin/growth/SEO";
import GrowthSocialMedia from "./pages/admin/growth/SocialMedia";
import GrowthInstagram from "./pages/admin/growth/Instagram";
import DiscountAndCoupon from "./pages/admin/growth/DiscountAndCoupon";
import AdminMarketplace from "./pages/admin/Marketplace";
import AdminShipping from "./pages/admin/Shipping";
import AdminGoogleReviews from "./pages/admin/GoogleReviews";
import Home from "./pages/customer/Home";
import CustomerProducts from "./pages/customer/Products";
import CustomerCategories from "./pages/customer/Categories";
import ProductDetail from "./pages/customer/ProductDetail";
import Cart from "./pages/customer/Cart";
import Checkout from "./pages/customer/Checkout";
import PaymentSuccess from "./pages/customer/PaymentSuccess";
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
import SuperAdminMarketplace from "./pages/superadmin/Marketplace";
import { SuperAdminGuard } from "./components/superadmin/SuperAdminGuard";
import { StoreGuard } from "./components/admin/StoreGuard";
import OnboardingStoreSetup from "./pages/onboarding/StoreSetup";
import OnboardingGoogleDrive from "./pages/onboarding/GoogleDriveSetup";
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
                        <Route path="dashboard" element={<SuperAdminDashboard />} />
                        <Route path="users" element={<SuperAdminUsers />} />
                        <Route path="helpers" element={<HelperManagement />} />
                        <Route path="commissions" element={<SuperAdminCommissions />} />
                        <Route path="commission-settings" element={<SuperAdminCommissionSettings />} />
                        <Route path="reports-analytics" element={<SuperAdminReportsAnalytics />} />
                        <Route path="subscription-plans" element={<SuperAdminSubscriptionPlans />} />
                        <Route path="transactions" element={<SuperAdminTransactions />} />
                        <Route path="billing" element={<SuperAdminBilling />} />
                        <Route path="custom-domains" element={<SuperAdminCustomDomains />} />
                        <Route path="settings" element={<SuperAdminPlatformSettings />} />
                        <Route path="sitemaps" element={<SuperAdminSitemapManager />} />
                        <Route path="marketplace" element={<SuperAdminMarketplace />} />
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
              </BrowserRouter>
            </CartProvider>
          </TooltipProvider>
        </ThemeProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
};

export default App;
