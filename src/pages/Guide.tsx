import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Menu, X, ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: {
    title: string;
    description: string;
    sections: {
      heading: string;
      content: string | string[];
    }[];
  };
  disabled?: boolean;
}

const Guide = () => {
  const [activeMenu, setActiveMenu] = useState("discount-coupon");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems: MenuSection[] = [
    {
      id: "discount-coupon",
      title: "Discount & Coupon",
      icon: "💰",
      content: {
        title: "Discount & Coupon System",
        description: "Learn how to use our powerful discount and coupon system to boost sales and customer loyalty.",
        sections: [
          {
            heading: "Overview",
            content: "DigitalDukandar provides two complementary discount systems to help you maximize revenue and customer satisfaction: Manual Coupons and Automatic Discounts. Each system serves unique business needs and can be used strategically to drive different business outcomes. Together, they create a powerful tool for revenue optimization, customer acquisition, and loyalty building."
          },
          {
            heading: "Business Benefits",
            content: [
              "📈 Increased Conversion Rates",
              "Strategic discounts remove price barriers that prevent purchases. Studies show that 40% of cart abandonments are due to unexpected costs. By offering clear, automatic discounts, you reduce friction and encourage checkout completion. Price-sensitive customers are more likely to complete purchases when they see immediate savings.",
              "",
              "💝 Customer Retention & Loyalty",
              "Returning customers are 50% more likely to buy and spend 31% more per transaction than new customers. Automatic returning customer discounts reward loyal buyers and incentivize repeat purchases. Manual coupons in email campaigns keep existing customers engaged with personalized offers.",
              "",
              "📊 Average Order Value (AOV) Growth",
              "Tiered discounts encourage larger purchases. For example, offering 5% off at ₹500 and 15% off at ₹2500 motivates customers to add more items to reach higher tiers. This directly increases your revenue per transaction. A 10% increase in AOV can result in 25-30% profit growth.",
              "",
              "🎯 New Customer Acquisition",
              "First-time purchase hesitation is a major barrier. Welcome discounts (15-20% off) reduce purchase anxiety and convert first-time browsers into customers. New customers acquired with discounts have a 90% probability of making a second purchase within 30 days when managed properly.",
              "",
              "📦 Inventory Management",
              "Excess inventory ties up capital and storage space. Category-based and quantity-based discounts help move slow-moving stock quickly. Instead of marking down prices permanently, use time-limited automatic discounts to clear inventory while maintaining margins on best-sellers.",
              "",
              "💳 Payment Method Optimization",
              "Online payments improve cash flow and reduce payment failure rates. By offering better discounts for online payments vs. COD, you encourage customers to choose faster, more reliable payment methods. This reduces churn due to failed COD collections.",
              "",
              "⚡ Competitive Advantage",
              "Manual discount systems require tracking spreadsheets and manual code creation. Automatic discounts respond instantly to business needs without manual intervention. You can launch new promotional strategies in minutes, not days, staying ahead of competitors.",
              "",
              "📉 Reduced Cart Abandonment",
              "Automatic discounts are applied at checkout, providing a pleasant surprise that recovers abandoned carts. Instead of offering fixed pricing that leads customers to shop elsewhere, dynamic discounts show personalized value based on their order.",
              "",
              "🔍 Data-Driven Decision Making",
              "Track which discount types drive conversions vs. which just lower margins. See exactly how each discount type performs, which customer segments respond best, and optimize your strategy based on real data. This prevents over-discounting and protects profitability."
            ]
          },
          {
            heading: "Services & Features",
            content: [
              "🎟️ Manual Coupons",
              "Create custom discount codes that customers manually enter at checkout. You control when coupons are active, who can use them, and how they're distributed. Perfect for email campaigns, social media promotions, influencer partnerships, and seasonal sales. Each coupon has its own code, discount amount, expiry date, and usage tracking.",
              "",
              "⚙️ Automatic Discounts",
              "Intelligent rules that automatically apply discounts based on customer behavior and order criteria. No customer action required—discounts appear instantly at checkout. Create once, apply to every relevant transaction. Types: tiered by order value, new customer, returning customer, category-based, quantity-based.",
              "",
              "🔐 Real-Time Server-Side Validation",
              "All discount calculations happen on secure servers, not client browsers. This prevents discount manipulation, ensures accuracy, and protects your system from fraud. Every checkout runs validation to check eligibility across all active rules in milliseconds.",
              "",
              "🏆 5 Discount Types for Every Business Need",
              "Tiered by Value (incentivize larger orders), New Customer (reduce first-purchase friction), Returning Customer (reward loyalty), Category-Based (promote specific products), Quantity-Based (encourage bulk purchases). Mix and match strategies to create sophisticated promotional campaigns.",
              "",
              "🛒 Payment Method Filtering",
              "Apply discounts to specific payment methods: ALL (both COD & Online), ONLINE ONLY (encourage digital payments), COD ONLY (encourage cash orders). This lets you incentivize preferred payment methods without uniform discounting.",
              "",
              "🎯 Highest Discount Priority Engine",
              "When multiple discount rules apply to a single order, the system automatically selects the highest discount amount. No customer confusion, no manual calculation. Example: If a returning customer qualifies for both a 10% loyalty discount AND a 5% category discount, they get 10%.",
              "",
              "⏰ Intelligent Expiry Management",
              "Set start and end dates for all discounts. Automatic discounts have defined active periods so they don't run indefinitely. Coupons have individual expiry dates. The system automatically disables expired discounts with no manual action needed.",
              "",
              "📊 Comprehensive Performance Tracking",
              "See in real-time: How many discounts were applied, total discount amount given, customer segments using each discount, revenue impact. Analytics dashboard shows which discounts drive actual conversions vs. which just commoditize pricing.",
              "",
              "👥 Customer Eligibility Validation",
              "For new/returning customer discounts: System checks customer history via email and phone number. Automatically determines if they're new or returning without any manual verification.",
              "",
              "🔄 No Coupon/Discount Duplication",
              "System prevents fraud by blocking duplicate coupon usage and complex rule combinations that could be exploited. Each transaction gets one discount (coupon takes priority if applied)."
            ]
          },
          {
            heading: "Manual Coupons",
            content: [
              "What are they?: Coupon codes that customers must manually find and apply at checkout",
              "When to use: Limited-time promotions, email campaigns, social media contests, affiliate partnerships",
              "How to create:",
              "  • Go to Discount & Coupon page in admin dashboard",
              "  • Click 'Create Coupon' button",
              "  • Set coupon code (e.g., SAVE20)",
              "  • Choose discount type: Percentage or Fixed amount",
              "  • Set expiry date",
              "  • Publish and share with customers",
              "Best practices: Keep codes memorable, set appropriate validity periods, track redemption rates"
            ]
          },
          {
            heading: "Automatic Discounts",
            content: [
              "What are they?: Smart rules that automatically apply discounts without customer action",
              "When to use: Always-on promotions, customer loyalty programs, seasonal sales, inventory clearance",
              "Discount Types:",
              "  • Tiered by Value: Different discounts at different order amounts",
              "  • New Customer: Welcome discount for first-time buyers",
              "  • Returning Customer: Loyalty bonus for repeat customers",
              "  • Category-Based: Discounts on specific product categories",
              "  • Quantity-Based: Bulk purchase incentives"
            ]
          },
          {
            heading: "How Automatic Discounts Work",
            content: [
              "Setup: Create discount rules in the Discount & Coupon admin page",
              "Validation: During checkout, our system validates all applicable rules",
              "Selection: If multiple rules apply, the highest discount amount wins automatically",
              "Application: Discount is shown to customer before payment",
              "Exclusion: If customer applies a manual coupon, automatic discounts are disabled",
              "Priority: Always: Coupon > Automatic Discount"
            ]
          },
          {
            heading: "Tiered Discount Example",
            content: [
              "Use case: Encourage larger purchases",
              "Setup:",
              "  • Tier 1: Orders ₹500-₹999 → 5% off",
              "  • Tier 2: Orders ₹1000-₹2499 → 10% off",
              "  • Tier 3: Orders ₹2500+ → 15% off",
              "Result: Customer buying ₹3000 worth automatically gets 15% (₹450) discount"
            ]
          },
          {
            heading: "New Customer Discount Example",
            content: [
              "Use case: Reduce friction for first-time purchases",
              "Setup: 20% off for customers with no previous orders",
              "Validation: System checks customer email/phone against order history",
              "Result: First-time customers see discount automatically, encouraging purchase"
            ]
          },
          {
            heading: "Category-Based Discount Example",
            content: [
              "Use case: Promote specific product categories",
              "Setup: 25% off all 'Electronics' category products",
              "Scope: Discount applies only to items in that category",
              "Result: Customers buying electronics get automatic discount; other categories unaffected"
            ]
          },
          {
            heading: "Quantity-Based Discount Example",
            content: [
              "Use case: Bulk purchase incentives",
              "Setup: Buy 5+ items → Get 10% off entire order",
              "Validation: System counts total items in cart",
              "Result: Customer with 6+ items automatically receives discount"
            ]
          },
          {
            heading: "Best Practices",
            content: [
              "Balance Margins: Ensure discounts don't erode profitability",
              "Test First: Use limited testing before full rollout",
              "Clear Communication: Help customers understand how they're getting discounts",
              "Monitor Performance: Track which discounts drive conversions vs. just lower margins",
              "Seasonal Strategy: Adjust discounts based on demand and inventory levels",
              "Avoid Over-Complexity: Too many overlapping rules confuse customers and your system",
              "Set Expiry Dates: Automatic discounts should have defined active periods",
              "Combine Strategically: Mix coupon and automatic discount strategies for maximum impact"
            ]
          },
          {
            heading: "Payment Method Integration",
            content: [
              "When creating discounts, you can specify payment method applicability:",
              "  • All: Works for both COD and Online payments",
              "  • Online Only: Encourages digital payment adoption",
              "  • COD Only: Encourages cash-on-delivery purchases",
              "Use case: Offer better discounts for online payments to improve cash flow"
            ]
          },
          {
            heading: "Common Questions",
            content: [
              "Q: Can I use both coupons and automatic discounts?",
              "A: Yes! They work together. If no coupon is applied, automatic discounts activate.",
              "",
              "Q: What happens if multiple automatic discounts apply?",
              "A: The system automatically selects the one with the highest discount amount.",
              "",
              "Q: Can customers combine multiple coupons?",
              "A: No, only one coupon code per order. But they might qualify for automatic discounts too.",
              "",
              "Q: How often should I change my discounts?",
              "A: Review monthly based on sales data. Adjust based on seasonality and inventory.",
              "",
              "Q: Are discounts deducted from my revenue in reports?",
              "A: Yes, all reports show net revenue after discount deduction for accurate tracking."
            ]
          }
        ]
      }
    },
    {
      id: "products",
      title: "Products Management",
      icon: "📦",
      content: {
        title: "Products Management",
        description: "Coming soon: Learn how to manage your product catalog effectively.",
        sections: [
          {
            heading: "Coming Soon",
            content: "This section is under development. Check back soon for comprehensive product management guides."
          }
        ]
      },
      disabled: true
    },
    {
      id: "orders",
      title: "Orders & Shipping",
      icon: "🚚",
      content: {
        title: "Orders & Shipping",
        description: "Coming soon: Master order processing and shipping management.",
        sections: [
          {
            heading: "Coming Soon",
            content: "This section is under development. Check back soon for comprehensive order and shipping guides."
          }
        ]
      },
      disabled: true
    },
    {
      id: "analytics",
      title: "Analytics",
      icon: "📊",
      content: {
        title: "Analytics",
        description: "Coming soon: Understand your business metrics and growth.",
        sections: [
          {
            heading: "Coming Soon",
            content: "This section is under development. Check back soon for comprehensive analytics guides."
          }
        ]
      },
      disabled: true
    },
    {
      id: "seo",
      title: "SEO & Growth",
      icon: "🚀",
      content: {
        title: "SEO & Growth",
        description: "Coming soon: Optimize your store for search engines and growth.",
        sections: [
          {
            heading: "Coming Soon",
            content: "This section is under development. Check back soon for comprehensive SEO and growth guides."
          }
        ]
      },
      disabled: true
    },
    {
      id: "helper",
      title: "Helper Program",
      icon: "👥",
      content: {
        title: "Helper Program",
        description: "Coming soon: Build your referral and helper network.",
        sections: [
          {
            heading: "Coming Soon",
            content: "This section is under development. Check back soon for comprehensive helper program guides."
          }
        ]
      },
      disabled: true
    }
  ];

  const activeSection = menuItems.find(item => item.id === activeMenu);

  // Real-time search filtering
  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;

    const query = searchQuery.toLowerCase();
    return menuItems.filter(item =>
      item.title.toLowerCase().includes(query) ||
      item.content.title.toLowerCase().includes(query) ||
      item.content.description.toLowerCase().includes(query) ||
      item.content.sections.some(section =>
        section.heading.toLowerCase().includes(query) ||
        (typeof section.content === 'string' && section.content.toLowerCase().includes(query)) ||
        (Array.isArray(section.content) && section.content.some(c => c.toLowerCase().includes(query)))
      )
    );
  }, [searchQuery, menuItems]);

  // Highlight search matches in content
  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text;

    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase()
        ? `<mark class="bg-yellow-500/30 px-0.5 rounded">${part}</mark>`
        : part
    ).join('');
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Guide | DigitalDukandar</title>
        <meta name="description" content="Comprehensive guides and documentation for DigitalDukandar platform." />
        <meta name="keywords" content="guide, documentation, help, tutorials, discounts, coupons" />
        <meta property="og:title" content="Guide | DigitalDukandar" />
        <meta property="og:description" content="Comprehensive guides and documentation for DigitalDukandar platform." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Guide | DigitalDukandar" />
        <meta name="twitter:description" content="Comprehensive guides and documentation for DigitalDukandar platform." />
      </Helmet>

      {/* Header with Search */}
      <header className="border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent sticky top-0 z-40 backdrop-blur-sm">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          {/* Top Row: Back Button, Search Bar, Menu Button */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <Link to="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>

            {/* Search Bar - Center */}
            <div className="relative flex-1 max-w-lg mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search guides..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-muted/50 border-muted-foreground/20 text-sm"
              />
            </div>

            {/* Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors flex-shrink-0"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Bottom Row: Title and Subtitle */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold font-playfair mb-1">Documentation</h1>
            <p className="text-sm text-muted-foreground">Learn how to use DigitalDukandar features effectively</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 lg:px-8 py-8 flex gap-8">
        {/* Sidebar Navigation */}
        <aside className={cn(
          "w-full md:w-64 lg:w-72 flex-shrink-0",
          "fixed md:relative left-0 top-0 h-screen md:h-auto z-30 md:z-auto",
          "bg-background md:bg-transparent pt-20 md:pt-0 px-4 md:px-0",
          "overflow-y-auto transition-all duration-300",
          mobileMenuOpen ? "block" : "hidden md:block"
        )}>
          <nav className="space-y-2">
            {filteredMenuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveMenu(item.id);
                  setMobileMenuOpen(false);
                }}
                disabled={item.disabled}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-between group",
                  activeMenu === item.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-foreground hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                  item.disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium text-sm">{item.title}</span>
                </span>
                {item.disabled && <Lock className="w-3 h-3" />}
                {activeMenu === item.id && !item.disabled && (
                  <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
                )}
              </button>
            ))}
          </nav>

          {searchQuery && filteredMenuItems.length === 0 && (
            <div className="mt-8 p-4 text-center text-sm text-muted-foreground">
              No results found for "{searchQuery}"
            </div>
          )}
        </aside>

        {/* Overlay on mobile */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {activeSection ? (
            <article className="max-w-3xl space-y-8">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold font-playfair mb-4">{activeSection.content.title}</h1>
                <p className="text-lg text-muted-foreground">{activeSection.content.description}</p>
              </div>

              {activeSection.disabled ? (
                <div className="bg-muted/30 border border-muted-foreground/20 rounded-lg p-8 text-center">
                  <Lock className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">This guide is coming soon. Check back later for detailed documentation.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {activeSection.content.sections.map((section, idx) => (
                    <section key={idx}>
                      <h2 className="text-2xl md:text-3xl font-bold mb-4">{section.heading}</h2>
                      {Array.isArray(section.content) ? (
                        <ul className="space-y-3 text-foreground/90 leading-relaxed">
                          {section.content.map((item, i) => (
                            <li key={i} className={cn(
                              item.startsWith('  ') ? "ml-6 list-none" : "ml-0 list-disc list-inside"
                            )}>
                              {item.replace(/^  /, '')}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{section.content}</p>
                      )}
                    </section>
                  ))}
                </div>
              )}

              {/* CTA Section */}
              {!activeSection.disabled && (
                <div className="mt-12 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg p-8 border border-primary/20">
                  <h3 className="text-xl font-bold mb-3">Still have questions?</h3>
                  <p className="text-muted-foreground mb-6">Need help with specific features? Visit your admin dashboard or contact our support team.</p>
                  <Link to="/auth">
                    <Button className="gap-2">
                      Go to Dashboard
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </article>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No content available</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
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
