import { lazy, Suspense, Component, ReactNode, useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";

import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { ScrollToTop } from "@/components/ScrollToTop";
import StorefrontLayout from "@/new-storefront/StorefrontLayout";
import { detectDomain, getStoreIdentifier } from "@/lib/domainUtils";

const Store = lazy(() => import("@/new-storefront/pages/Store"));
const CustomerProducts = lazy(() => import("@/new-storefront/pages/Products"));
const ProductDetail = lazy(() => import("@/new-storefront/pages/ProductDetail"));
const CustomerCategories = lazy(() => import("@/new-storefront/pages/Categories"));
const Cart = lazy(() => import("@/new-storefront/pages/Cart"));
const Checkout = lazy(() => import("@/new-storefront/pages/Checkout"));
const PaymentSuccess = lazy(() => import("@/new-storefront/pages/PaymentSuccess"));
const Policies = lazy(() => import("@/new-storefront/pages/Policies"));
const About = lazy(() => import("@/new-storefront/pages/About"));
const Toaster = lazy(() => import("@/components/ui/toaster").then((module) => ({ default: module.Toaster })));
const Sonner = lazy(() => import("@/components/ui/sonner").then((module) => ({ default: module.Toaster })));

const PageLoader = () => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "hsl(var(--background))" }}>
    <div style={{ width: 32, height: 32, border: "2px solid hsl(var(--primary))", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

class ChunkErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const isChunkError =
      error.name === "ChunkLoadError" ||
      error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Loading chunk") ||
      error.message.includes("Importing a module script failed");

    if (isChunkError && !sessionStorage.getItem("storefront_chunk_reload")) {
      sessionStorage.setItem("storefront_chunk_reload", "1");
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

const StorefrontNotFound = () => (
  <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
    <div className="text-center">
      <h1 className="mb-4 text-4xl font-bold">404</h1>
      <p className="mb-4 text-xl text-muted-foreground">Page not found</p>
      <a href="/" className="text-primary underline underline-offset-4">
        Return to store
      </a>
    </div>
  </div>
);

const queryClient = new QueryClient();

const ClarityAnalytics = () => {
  useEffect(() => {
    const inject = () => {
      if ((window as any).clarity) return;
      (function (c: any, l: any, a: string, r: string, i: string) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        const t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
        const y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
      })(window, document, "clarity", "script", "wimnj0f7x4");
    };

    const schedule = () => {
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(inject, { timeout: 4000 });
      } else {
        setTimeout(inject, 3000);
      }
    };

    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }

    return () => window.removeEventListener("load", schedule);
  }, []);

  return null;
};

const DeferredToasters = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const show = () => setReady(true);

    if ("requestIdleCallback" in window) {
      const idleId = (window as any).requestIdleCallback(show, { timeout: 3000 });
      return () => (window as any).cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(show, 1500);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <Toaster />
      <Sonner />
    </Suspense>
  );
};

const StorefrontRoutes = () => {
  const domainInfo = detectDomain();
  const storeIdentifier = getStoreIdentifier();

  if (domainInfo.isStoreSpecific && storeIdentifier) {
    return (
      <Routes>
        <Route element={<StorefrontLayout slug={storeIdentifier} />}>
          <Route path="/" element={<Store slug={storeIdentifier} />} />
          <Route path="/policies" element={<Policies slug={storeIdentifier} />} />
          <Route path="/about" element={<About />} />
          <Route path="/categories" element={<CustomerCategories slug={storeIdentifier} />} />
          <Route path="/products" element={<CustomerProducts slug={storeIdentifier} />} />
          <Route path="/products/:slug" element={<ProductDetail slug={storeIdentifier} />} />
          <Route path="/cart" element={<Cart slug={storeIdentifier} />} />
          <Route path="/checkout" element={<Checkout slug={storeIdentifier} />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
        </Route>
        <Route path="*" element={<StorefrontNotFound />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/:slug" element={<StorefrontLayout />}>
        <Route index element={<Store />} />
        <Route path="policies" element={<Policies />} />
        <Route path="about" element={<About />} />
        <Route path="categories" element={<CustomerCategories />} />
        <Route path="products" element={<CustomerProducts />} />
        <Route path="products/:productSlug" element={<ProductDetail />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="payment-success" element={<PaymentSuccess />} />
      </Route>
      <Route path="*" element={<StorefrontNotFound />} />
    </Routes>
  );
};

const StorefrontApp = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <TooltipProvider>
          <CartProvider>
            <DeferredToasters />
            <BrowserRouter>
              <ClarityAnalytics />
              <ScrollToTop />
              <ChunkErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <StorefrontRoutes />
                </Suspense>
              </ChunkErrorBoundary>
            </BrowserRouter>
          </CartProvider>
        </TooltipProvider>
      </ThemeProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default StorefrontApp;
