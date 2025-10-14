import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import WhatsAppFloat from "@/components/customer/WhatsAppFloat";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminSettings from "./pages/admin/Settings";
import Products from "./pages/admin/Products";
import AddProduct from "./pages/admin/AddProduct";
import EditProduct from "./pages/admin/EditProduct";
import GoogleSheetsSync from "./pages/admin/GoogleSheetsSync";
import Home from "./pages/customer/Home";
import CustomerProducts from "./pages/customer/Products";
import ProductDetail from "./pages/customer/ProductDetail";
import Cart from "./pages/customer/Cart";
import Checkout from "./pages/customer/Checkout";
import Auth from "./pages/Auth";
import SuperAdminLogin from "./pages/superadmin/Login";
import SuperAdminDashboard from "./pages/superadmin/Dashboard";
import SuperAdminUsers from "./pages/superadmin/Users";
import OnboardingStoreSetup from "./pages/onboarding/StoreSetup";
import OnboardingGoogleSheets from "./pages/onboarding/GoogleSheets";
import OnboardingCustomize from "./pages/onboarding/Customize";
import OnboardingComplete from "./pages/onboarding/Complete";


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
            
            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/products" element={<Products />} />
            <Route path="/admin/products/add" element={<AddProduct />} />
            <Route path="/admin/products/edit/:id" element={<EditProduct />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/google-sheets" element={<GoogleSheetsSync />} />
            
            {/* Super Admin Routes */}
            <Route path="/superadmin/login" element={<SuperAdminLogin />} />
            <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
            <Route path="/superadmin/users" element={<SuperAdminUsers />} />
            
            {/* Onboarding Routes */}
            <Route path="/onboarding/store-setup" element={<OnboardingStoreSetup />} />
            <Route path="/onboarding/google-sheets" element={<OnboardingGoogleSheets />} />
            <Route path="/onboarding/customize" element={<OnboardingCustomize />} />
            <Route path="/onboarding/complete" element={<OnboardingComplete />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
