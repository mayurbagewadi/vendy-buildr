import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Menu, ChevronRight, Lock, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

// Hide scrollbars while keeping scroll functionality
const scrollbarHideStyles = `
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in-up {
    animation: fadeInUp 0.6s ease-out forwards;
  }

  .menu-item-hover {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .menu-item-hover:hover {
    transform: translateX(4px);
  }
`;

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
  const [activeMenu, setActiveMenu] = useState("store-signup");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems: MenuSection[] = [
    {
      id: "store-signup",
      title: "Store Signup",
      icon: "🚀",
      content: {
        title: "Create Your Store - Quick Start Guide",
        description: "Get started in minutes! Follow this step-by-step guide to create your online store and start selling.",
        sections: [
          {
            heading: "Why Sign Up with DigitalDukandar?",
            content: [
              "✅ No coding required - Build your store without technical skills",
              "✅ Free to start - 14-day free trial, no credit card needed",
              "✅ WhatsApp integrated - Customers order via WhatsApp directly",
              "✅ Pre-loaded store - Get demo products and categories automatically",
              "✅ Instant subdomain - Your store goes live immediately at yourstore.yesgive.shop",
              "✅ Google Drive integration - Store your product images in Google Drive",
              "✅ Multi-payment support - Accept both Online and Cash on Delivery",
              "✅ Easy analytics - Track sales, orders, and customer insights",
              "✅ Referral program - Earn commissions by referring other sellers",
              "✅ Professional support - 24/7 help available"
            ]
          },
          {
            heading: "What You'll Need",
            content: [
              "✓ Google Account (for sign-in and Google Drive storage)",
              "✓ Store Name (what customers will see)",
              "✓ WhatsApp Business Number (customers order via WhatsApp)",
              "✓ Internet connection",
              "✓ 5 minutes to set up"
            ]
          },
          {
            heading: "Step 1: Open Menu & Get Started",
            content: [
              "On your mobile or desktop:",
              "",
              "1. Open yesgive.shop",
              "2. Click the 3-bar Menu icon (☰) at top left",
              "3. Click 'Get Started' button",
              "4. Click 'Sign in with Google'",
              "5. Select your Google account",
              "6. Approve Google account access",
              "",
              "⏱️ Takes less than 1 minute"
            ]
          },
          {
            heading: "Step 2: Fill Store Details",
            content: [
              "After Google sign-in, you'll see the Store Setup form. Fill in:",
              "",
              "📝 Store Name (Required)",
              "  • What customers will see as your business name",
              "  • Examples: 'Fresh Fruits Market', 'Fashion Hub', 'Electronics Store'",
              "  • Can be 2-50 characters",
              "  • Tip: Your store URL is auto-generated from this name",
              "  • You can change this later in settings",
              "",
              "📄 Store Description (Optional)",
              "  • Brief description of your business",
              "  • What you sell and why customers should choose you",
              "  • Max 500 characters",
              "  • Examples: 'Fresh organic vegetables delivered daily'",
              "  • Leave blank if you'll add this later",
              "",
              "📱 WhatsApp Number (Required)",
              "  • This is the number where you WILL RECEIVE ORDERS",
              "  • Customers will message this number to place orders",
              "  • Select your country code (India: +91, USA: +1, UK: +44, UAE: +971)",
              "  • Enter your 10-digit phone number",
              "  • Make sure you have WhatsApp installed on this number",
              "  • Example: Country: India (+91), Phone: 9876543210",
              "",
              "🔗 Store URL (Auto-generated - Read-only)",
              "  • Your unique web address automatically generated from store name",
              "  • Example: 'Fresh Fruits Market' → freshfruits.yesgive.shop",
              "  • Only lowercase letters and numbers",
              "  • This CANNOT be changed later, so choose your store name carefully!",
              "  • You'll see a ✓ (available) or ✗ (taken) indicator"
            ]
          },
          {
            heading: "Step 3: Click 'Continue'",
            content: [
              "After filling all required details:",
              "",
              "1. Review your information (especially Store Name - it determines your URL)",
              "2. Verify your WhatsApp number is correct",
              "3. Click the 'Continue' button",
              "",
              "What happens automatically:",
              "  ✓ Your store is created instantly",
              "  ✓ Store URL is registered (yourstore.digitaldukandar.in)",
              "  ✓ Demo products are added (15+ sample products)",
              "  ✓ Demo categories are added",
              "  ✓ 14-day free trial is activated",
              "",
              "⏱️ Takes less than 2 minutes total"
            ]
          },
          {
            heading: "Step 4: Google Drive Setup",
            content: [
              "After clicking Continue in Step 3, a NEW PAGE opens for Google Drive setup.",
              "",
              "What Google Drive does:",
              "  ✓ Store all your product images in Google Drive",
              "  ✓ Free cloud storage (up to 15GB for images)",
              "  ✓ Automatic backup of your images",
              "  ✓ Easy image management and organization",
              "  ✓ Access images from anywhere",
              "",
              "How to connect Google Drive:",
              "  1. On the new Google Drive page, click 'Connect Google Drive' button",
              "  2. Select your Google account",
              "  3. Approve permissions (allow access to Google Drive)",
              "  4. Connection is complete",
              "  5. Click 'Continue' to go to your admin panel",
              "",
              "Or you can skip:",
              "  • Click 'Skip' or 'Continue' without connecting",
              "  • You can connect anytime from Store Settings later",
              "  • Optional but recommended for convenience",
              "",
              "⏱️ Takes less than 1 minute (or 5 seconds to skip)"
            ]
          },
          {
            heading: "Step 5: Access Your Admin Panel",
            content: [
              "Congratulations! 🎉 You're in your Store Admin Panel!",
              "",
              "Your store is NOW LIVE at: yourstore.digitaldukandar.in",
              "",
              "Your store automatically comes pre-loaded with:",
              "  📦 15+ Demo Products - Sample products ready to show customers",
              "  🏷️ Demo Categories - Electronics, Fashion, Home & Living, etc.",
              "  💡 Everything is ready - No setup needed!",
              "",
              "What you can do right now:",
              "  📦 Manage Products - Edit, add, or delete products",
              "  📋 Manage Categories - Create and organize product categories",
              "  📊 View Analytics - Track sales, visitors, and orders",
              "  🛒 Manage Orders - See customer orders and process them",
              "  💰 Set Discounts - Create coupons and automatic discounts",
              "  ⚙️ Store Settings - Update store info, logo, colors, banner",
              "  🚀 Growth Tools - Setup SEO, social media, marketing",
              "  📱 WhatsApp Orders - Customers can order via the WhatsApp number you provided",
              "",
              "✅ Your store is ready! Customers can now find you at yourstore.digitaldukandar.in"
            ]
          },
          
          {
            heading: "Common Questions About Signup",
            content: [
              "Q: Is signup really free?",
              "A: Yes! 14-day free trial with full features. No credit card required. You only pay after trial if you want to continue.",
              "",
              "Q: Do I need technical skills?",
              "A: No! The platform is designed for non-technical users. All done through simple forms and menus.",
              "",
              "Q: Can I change my store URL?",
              "A: No, once created it cannot be changed. That's why we recommend choosing carefully. The URL shows in all customer emails and WhatsApp messages.",
              "",
              "Q: What if my store URL is already taken?",
              "A: Modify your store name to make the URL unique. The system will automatically generate a new one and show if it's available.",
              "",
              "Q: Can I have multiple stores?",
              "A: Yes! Create separate accounts (with different Google accounts) for multiple stores. Each gets its own dashboard.",
              "",
              "Q: What language is the store in?",
              "A: Currently available in English. Multi-language support coming soon!",
              "",
              "Q: Do I need WhatsApp Business Account?",
              "A: No, regular WhatsApp works fine. You just share the number with customers and they message you.",
              "",
              "Q: Can I edit store details later?",
              "A: Yes! Most details can be changed in Store Settings. Only the store URL cannot be changed.",
              "",
              "Q: When does the free trial expire?",
              "A: 14 days from the date you create your store. You'll get email reminders before it expires.",
              "",
              "Q: What payment methods can customers use?",
              "A: Online payments and Cash on Delivery. You can choose which methods to accept in settings.",
              "",
              "Q: Are my products visible immediately?",
              "A: Yes! Once you add a product, it appears on your store instantly. Customers can see it and order via WhatsApp.",
              "",
              "Q: Is customer data secure?",
              "A: Yes. We use enterprise-grade encryption and follow international security standards. Your data is safe with us."
            ]
          },
          {
            heading: "Need Help?",
            content: [
              "📖 Check our documentation for detailed guides on each feature",
              "💬 Contact support via WhatsApp or email",
              "📧 Check your welcome email for quick start tips",
              "🎓 Watch our video tutorials (coming soon)",
              "💡 Browse the FAQ section in your dashboard",
              "",
              "We're here to help! Don't hesitate to reach out with questions."
            ]
          }
        ]
      }
    },
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <style>{scrollbarHideStyles}</style>
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
      <header className="border-b border-border/30 bg-background/95 backdrop-blur-xl sticky top-0 z-50 shadow-lg shadow-black/5">
        <div className="container mx-auto px-4 lg:px-8 py-8">
          <div className="flex items-center justify-between gap-6">
            {/* Left Section: Menu Button + Title */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Menu Toggle Button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-3 hover:bg-primary/10 rounded-xl transition-all duration-300 border border-border/50 hover:border-primary/30 hover:shadow-md"
                aria-label="Toggle sidebar"
                title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <Menu className="w-5 h-5 text-foreground" />
              </button>

              {/* Title with Icon */}
              <div className="select-none flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Documentation
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                    Comprehensive platform guides
                  </p>
                </div>
              </div>
            </div>

            {/* Center Section: Search Bar */}
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 bg-muted/50 border-border/50 focus:border-primary/50 text-sm w-full rounded-xl shadow-sm"
              />
            </div>

            {/* Right Section: Back Button */}
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-all duration-300 flex-shrink-0 px-4 py-2.5 rounded-xl hover:bg-primary/10 border border-transparent hover:border-primary/20"
              title="Back to home"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">Back</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 lg:px-8 pt-8 min-h-[calc(100vh-140px)]">
        <div className="flex gap-8 pb-8 h-full">
          {/* Sidebar Navigation */}
          <aside className={cn(
            "w-72 lg:w-80 flex-shrink-0 transition-all duration-300 ease-in-out",
            sidebarOpen ? "block" : "hidden"
          )}>
            <div className="sticky top-[120px] space-y-3 max-h-[calc(100vh-140px)] overflow-y-auto pr-3 hide-scrollbar">
              <div className="mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 mb-3">
                  Guide Topics
                </h2>
              </div>

              {filteredMenuItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveMenu(item.id);
                  }}
                  disabled={item.disabled}
                  className={cn(
                    "w-full text-left px-5 py-4 rounded-xl transition-all duration-300 flex items-center justify-between group menu-item-hover",
                    "animate-fade-in-up",
                    activeMenu === item.id
                      ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                      : "hover:bg-muted/80 text-foreground/90 hover:text-foreground border border-border/30 hover:border-border/50 hover:shadow-md",
                    item.disabled && "opacity-50 cursor-not-allowed hover:transform-none"
                  )}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-medium text-[15px]">{item.title}</span>
                  </span>
                  {item.disabled ? (
                    <Lock className="w-3.5 h-3.5 opacity-50" />
                  ) : activeMenu === item.id ? (
                    <ChevronRight className="w-4 h-4 ml-auto transition-transform group-hover:translate-x-1" />
                  ) : null}
                </button>
              ))}

              {searchQuery && filteredMenuItems.length === 0 && (
                <div className="mt-8 p-6 text-center text-sm text-muted-foreground border-2 border-dashed border-muted-foreground/20 rounded-xl bg-muted/30">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No results found for "{searchQuery}"</p>
                </div>
              )}
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 overflow-y-auto hide-scrollbar" style={{ maxHeight: 'calc(100vh - 160px)' }}>
            {activeSection ? (
              <article className="max-w-4xl space-y-10 animate-fade-in-up pb-12">
                {/* Title Section */}
                <div className="border-b border-border/40 pb-8 pt-4">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
                    {activeSection.content.title}
                  </h1>
                  <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                    {activeSection.content.description}
                  </p>
                </div>

                {activeSection.disabled ? (
                  <div className="bg-gradient-to-br from-muted/40 to-muted/20 border-2 border-dashed border-muted-foreground/20 rounded-2xl p-16 text-center">
                    <div className="inline-flex p-4 bg-muted/50 rounded-full mb-4">
                      <Lock className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">Coming Soon</h3>
                    <p className="text-muted-foreground text-lg max-w-md mx-auto">
                      This guide is under development. Check back later for detailed documentation.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-12">
                    {activeSection.content.sections.map((section, idx) => (
                      <section key={idx} className="scroll-mt-32">
                        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground pt-4 pb-2 border-l-4 border-primary pl-6">
                          {section.heading}
                        </h2>
                        {Array.isArray(section.content) ? (
                          <div className="space-y-4 pl-6">
                            {section.content.map((item, i) => {
                              if (item === "") {
                                return <div key={i} className="h-6" />;
                              }

                              const isIndented = item.startsWith('  ');
                              const isBold = item.includes('Q:') || item.includes('A:');
                              const cleanItem = item.replace(/^  /, '');

                              return (
                                <p
                                  key={i}
                                  className={cn(
                                    "text-foreground/90 leading-relaxed text-base",
                                    isIndented && "ml-8 pl-4 border-l-2 border-muted-foreground/20",
                                    isBold && "font-semibold mt-4 text-foreground"
                                  )}
                                >
                                  {cleanItem}
                                </p>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-foreground/90 leading-relaxed text-base whitespace-pre-wrap pl-6">
                            {section.content}
                          </p>
                        )}
                      </section>
                    ))}
                  </div>
                )}

                {/* CTA Section */}
                {!activeSection.disabled && (
                  <div className="mt-20 bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 rounded-2xl p-10 border border-primary/20 shadow-xl shadow-primary/5">
                    <h3 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
                      Still have questions?
                    </h3>
                    <p className="text-muted-foreground text-lg mb-8 max-w-2xl">
                      Need help with specific features? Visit your admin dashboard or contact our support team for personalized assistance.
                    </p>
                    <Link to="/auth">
                      <Button className="gap-2 h-12 px-6 text-base shadow-lg hover:shadow-xl transition-all duration-300">
                        Go to Dashboard
                        <ChevronRight className="w-5 h-5" />
                      </Button>
                    </Link>
                  </div>
                )}
              </article>
            ) : (
              <div className="text-center py-32">
                <div className="inline-flex p-6 bg-muted/50 rounded-full mb-6">
                  <BookOpen className="w-16 h-16 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-xl">
                  Select a guide from the sidebar to get started
                </p>
              </div>
            )}
          </main>
        </div>
      </div>

    </div>
  );
};

export default Guide;
