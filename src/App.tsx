import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import WhatsAppFloat from "@/components/customer/WhatsAppFloat";
import Index from "./pages/Index";
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
import Home from "./pages/customer/Home";
import CustomerProducts from "./pages/customer/Products";
import ProductDetail from "./pages/customer/ProductDetail";
import Cart from "./pages/customer/Cart";
import Checkout from "./pages/customer/Checkout";
import Pricing from "./pages/customer/Pricing";
import Auth from "./pages/Auth";
import SuperAdminLogin from "./pages/superadmin/Login";
import SuperAdminDashboard from "./pages/superadmin/Dashboard";
import SuperAdminUsers from "./pages/superadmin/Users";
import SuperAdminSubscriptionPlans from "./pages/superadmin/SubscriptionPlans";
import SuperAdminTransactions from "./pages/superadmin/Transactions";
import SuperAdminCustomDomains from "./pages/superadmin/CustomDomains";
import SuperAdminPlatformSettings from "./pages/superadmin/PlatformSettings";
import OnboardingStoreSetup from "./pages/onboarding/StoreSetup";
import OnboardingCustomize from "./pages/onboarding/Customize";
import OnboardingComplete from "./pages/onboarding/Complete";
import Store from "./pages/customer/Store";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Customer Routes */}
            <Route path="/home" element={<Home />} />
            <Route path="/products" element={<CustomerProducts />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/pricing" element={<Pricing />} />
            
            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/products" element={<Products />} />
            <Route path="/admin/products/add" element={<AddProduct />} />
            <Route path="/admin/products/edit/:id" element={<EditProduct />} />
            <Route path="/admin/categories" element={<Categories />} />
            <Route path="/admin/orders" element={<Orders />} />
            <Route path="/admin/analytics" element={<Analytics />} />
            <Route path="/admin/subscription" element={<Subscription />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            
            {/* Super Admin Routes */}
            <Route path="/superadmin/login" element={<SuperAdminLogin />} />
            <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
            <Route path="/superadmin/users" element={<SuperAdminUsers />} />
            <Route path="/superadmin/subscription-plans" element={<SuperAdminSubscriptionPlans />} />
            <Route path="/superadmin/transactions" element={<SuperAdminTransactions />} />
            <Route path="/superadmin/custom-domains" element={<SuperAdminCustomDomains />} />
            <Route path="/superadmin/settings" element={<SuperAdminPlatformSettings />} />
            
            {/* Onboarding Routes */}
            <Route path="/onboarding/store-setup" element={<OnboardingStoreSetup />} />
            <Route path="/onboarding/customize" element={<OnboardingCustomize />} />
            <Route path="/onboarding/complete" element={<OnboardingComplete />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            {/* Dynamic Store Route - must be last before 404 */}
            <Route path="/:slug" element={<Store />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
