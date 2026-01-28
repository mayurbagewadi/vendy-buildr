import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

const Guide = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Guide | DigitalDukandar</title>
        <meta name="description" content="Learn how to use DigitalDukandar and maximize your store's potential." />
        <meta name="keywords" content="guide, help, tutorial, documentation" />
        <meta property="og:title" content="Guide | DigitalDukandar" />
        <meta property="og:description" content="Learn how to use DigitalDukandar and maximize your store's potential." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Guide | DigitalDukandar" />
        <meta name="twitter:description" content="Learn how to use DigitalDukandar and maximize your store's potential." />
      </Helmet>

      {/* Header with Back Button */}
      <header className="border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent sticky top-0 z-40">
        <div className="container mx-auto px-4 lg:px-8 py-8">
          <Link to="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold font-playfair mb-2">Guide</h1>
            <p className="text-muted-foreground text-lg">Learn how to use DigitalDukandar effectively</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 lg:px-8 py-16 max-w-4xl">
        <div className="prose prose-invert max-w-none space-y-12">
          {/* Getting Started Section */}
          <section>
            <h2 className="text-3xl font-bold mb-4">Getting Started</h2>
            <p className="text-muted-foreground mb-4">
              Welcome to DigitalDukandar! This guide will help you get the most out of your store.
            </p>
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Follow these sections to understand different features:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Store Setup and Configuration</li>
                <li>Product Management</li>
                <li>Order Management</li>
                <li>Analytics and Reports</li>
                <li>Promotions and Discounts</li>
                <li>Payment Methods</li>
              </ul>
            </div>
          </section>

          {/* Store Setup Section */}
          <section>
            <h2 className="text-3xl font-bold mb-4">Store Setup</h2>
            <p className="text-muted-foreground mb-4">
              Get your store up and running in minutes. During onboarding, you'll:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Create your store with a custom subdomain</li>
              <li>Add store branding (logo, colors, banner)</li>
              <li>Configure basic settings</li>
              <li>Set up payment methods</li>
            </ul>
          </section>

          {/* Product Management Section */}
          <section>
            <h2 className="text-3xl font-bold mb-4">Product Management</h2>
            <p className="text-muted-foreground mb-4">
              Add and manage your products effectively:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Add products with descriptions and images</li>
              <li>Organize products into categories</li>
              <li>Set pricing and inventory levels</li>
              <li>Update product details anytime</li>
            </ul>
          </section>

          {/* Promotions Section */}
          <section>
            <h2 className="text-3xl font-bold mb-4">Promotions & Discounts</h2>
            <p className="text-muted-foreground mb-4">
              Boost sales with coupons and automatic discounts:
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2">Manual Coupons</h3>
                <p className="text-muted-foreground">
                  Create coupon codes that customers can manually apply at checkout.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Automatic Discounts</h3>
                <p className="text-muted-foreground">
                  Set up automatic discounts that apply based on specific conditions:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4 mt-2">
                  <li><strong>Tiered by Value:</strong> Different discounts for different order amounts</li>
                  <li><strong>New Customer:</strong> Special welcome discount for first-time buyers</li>
                  <li><strong>Returning Customer:</strong> Loyalty discount for repeat customers</li>
                  <li><strong>Category-Based:</strong> Discounts on specific product categories</li>
                  <li><strong>Quantity-Based:</strong> Discounts for bulk purchases</li>
                </ul>
              </div>
              <p className="text-muted-foreground text-sm border-l-2 border-primary/50 pl-4 italic">
                Note: If a customer applies a coupon manually, automatic discounts are disabled. Coupons take priority.
              </p>
            </div>
          </section>

          {/* Payment Methods Section */}
          <section>
            <h2 className="text-3xl font-bold mb-4">Payment Methods</h2>
            <p className="text-muted-foreground mb-4">
              Support multiple payment options:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Cash on Delivery (COD)</li>
              <li>Online Payment (via payment gateway)</li>
              <li>Both options available simultaneously</li>
            </ul>
          </section>

          {/* Orders & Analytics Section */}
          <section>
            <h2 className="text-3xl font-bold mb-4">Orders & Analytics</h2>
            <p className="text-muted-foreground mb-4">
              Track your business performance:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>View all incoming orders</li>
              <li>Track order status</li>
              <li>Access sales analytics and reports</li>
              <li>Monitor revenue trends</li>
              <li>Analyze customer behavior</li>
            </ul>
          </section>

          {/* Helper/Referral Program Section */}
          <section>
            <h2 className="text-3xl font-bold mb-4">Helper & Referral Program</h2>
            <p className="text-muted-foreground mb-4">
              Grow your business through our helper network:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Earn commissions from referrals</li>
              <li>Build your helper network</li>
              <li>Track referral performance</li>
              <li>View commission history</li>
            </ul>
          </section>

          {/* SEO & Growth Section */}
          <section>
            <h2 className="text-3xl font-bold mb-4">SEO & Growth</h2>
            <p className="text-muted-foreground mb-4">
              Optimize your store for growth:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Automatic SEO optimization</li>
              <li>Social media integration</li>
              <li>Instagram catalog sync</li>
              <li>Google Reviews management</li>
              <li>Marketplace integration</li>
            </ul>
          </section>

          {/* FAQ Section */}
          <section>
            <h2 className="text-3xl font-bold mb-4">Common Questions</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">How long does it take to set up my store?</h3>
                <p className="text-muted-foreground">
                  You can set up your basic store in just a few minutes. Full customization and product catalog setup may take longer depending on how many products you have.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Can I change my store name later?</h3>
                <p className="text-muted-foreground">
                  Yes, you can update your store settings at any time from the admin dashboard.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">How do automatic discounts work?</h3>
                <p className="text-muted-foreground">
                  Automatic discounts are applied at checkout based on conditions you set. If multiple rules apply, the highest discount is automatically selected for the customer.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Can I use both coupons and automatic discounts?</h3>
                <p className="text-muted-foreground">
                  Yes, both systems work together. However, if a customer applies a coupon manually, automatic discounts won't apply. Coupons take priority.
                </p>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg p-8 border border-primary/20">
            <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-muted-foreground mb-6">
              Create your store now and start selling with DigitalDukandar.
            </p>
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Create Your Store
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </section>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-border/50 bg-muted/20 mt-20">
        <div className="container mx-auto px-4 lg:px-8 py-8">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 DigitalDukandar. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Guide;
