import { useState, useMemo, useRef, useEffect } from "react";
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

interface SubOption {
  id: string;
  label: string;
  title: string;
  description: string;
  sections: {
    heading: string;
    content: string | string[];
    image?: string;
  }[];
}

interface MenuSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content?: {
    title: string;
    description: string;
    sections: {
      heading: string;
      content: string | string[];
      image?: string;
    }[];
  };
  subOptions?: SubOption[];
  disabled?: boolean;
}

const Guide = () => {
  const [activeMenu, setActiveMenu] = useState("settings");
  const [activeSubOption, setActiveSubOption] = useState<string | null>("gst-invoice-setup");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [barPosition, setBarPosition] = useState(0);
  const [barHeight, setBarHeight] = useState(0);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const menuItemsRef = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // Toggle menu open/close - if clicking same item, close it
  const handleMenuClick = (menuId: string) => {
    if (activeMenu === menuId) {
      // Clicking same menu - toggle close
      setActiveMenu(null);
      setActiveSubOption(null);
    } else {
      // Clicking different menu - open it
      setActiveMenu(menuId);
      const menuItem = menuItems.find(item => item.id === menuId);
      if (menuItem?.subOptions && menuItem.subOptions.length > 0) {
        setActiveSubOption(menuItem.subOptions[0].id);
      } else {
        setActiveSubOption(null);
      }
    }
  };

  // Update sliding bar position when active menu changes or when scrolling
  useEffect(() => {
    const updateBarPosition = () => {
      const activeElement = menuItemsRef.current[activeMenu || ""];
      if (activeElement && menuContainerRef.current) {
        const container = menuContainerRef.current;
        const elementTop = activeElement.offsetTop;
        const elementHeight = activeElement.offsetHeight;

        setBarPosition(elementTop);
        setBarHeight(elementHeight);
      }
    };

    updateBarPosition();

    const container = menuContainerRef.current;
    if (container) {
      container.addEventListener("scroll", updateBarPosition);
      return () => container.removeEventListener("scroll", updateBarPosition);
    }
  }, [activeMenu]);

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
              "✅ Instant subdomain - Your store goes live immediately at yourstore.digitaldukandar.in",
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
              "1. Open digitaldukandar.in",
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
              "  • Example: 'Fresh Fruits Market' → freshfruits.digitaldukandar.in",
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
      id: "settings",
      title: "Settings",
      icon: "⚙️",
      subOptions: [
        {
          id: "gst-invoice-setup",
          label: "GST & Invoice Setup",
          title: "GST Invoice Setup for Online Store in India",
          description: "Set GSTIN, GST percentage, invoice number, customer GST summary, and admin invoice download correctly for your DigitalDukandar store.",
          sections: [
            {
              heading: "What is GST Invoice Setup?",
              content: [
                "GST invoice setup lets a store owner add GST details to checkout, order summaries, order records, and downloadable invoices.",
                "",
                "In DigitalDukandar, this setup includes GST enable or disable, GSTIN, default GST percentage, invoice prefix, next invoice number, price includes GST, and show GST on summary.",
                "",
                "This guide is for Indian online stores that want a simple GST invoice setup without changing product pages one by one.",
                "",
                "Important: DigitalDukandar helps you configure GST display and invoice records. Store owners should confirm their GST registration, GST rate, HSN/SAC needs, and filing rules with their accountant or tax advisor."
              ]
            },
            {
              heading: "GST Setup Keywords This Guide Answers",
              content: [
                "Primary topic: GST invoice setup for online store India.",
                "",
                "This guide also answers: how to add GST to online store, GSTIN setup for ecommerce website, GST settings for ecommerce store, invoice number setup for online orders, GST invoice download online store, and how GST appears in customer order summary.",
                "",
                "Simple answer: Go to Admin -> Settings -> GST & Invoicing, enable GST, enter GSTIN, enter the correct GST percentage, set invoice prefix and next invoice number, then save."
              ]
            },
            {
              heading: "Where to Find GST Settings",
              content: [
                "1. Log in to your store admin panel.",
                "2. Open Settings from the admin sidebar.",
                "3. Find the GST & Invoicing section.",
                "4. Turn on Enable GST.",
                "5. Fill GSTIN, GST percentage, invoice prefix, and next invoice number.",
                "6. Click Save Changes.",
                "",
                "If GST is off, checkout will not add GST and new orders will be saved without GST invoice details."
              ]
            },
            {
              heading: "GSTIN Setup",
              content: [
                "GSTIN is the 15-character Goods and Services Tax Identification Number of the registered business.",
                "",
                "Example GSTIN format: 27ABCDE1234F1Z5",
                "",
                "Enter GSTIN only if the store/business is GST registered. If the store owner is not registered for GST, keep GST disabled until their accountant confirms they should enable it.",
                "",
                "Bad idea: using a fake GSTIN just to show GST on invoice.",
                "Better: use only the real registered GSTIN of the business."
              ]
            },
            {
              heading: "Default GST Percentage",
              content: [
                "Default GST Percentage is the store-level GST rate used for new orders.",
                "",
                "Example: If product subtotal is Rs 100 and GST rate is 18%, GST amount is Rs 18 and total becomes Rs 118 when price does not include GST.",
                "",
                "Common GST slabs in India include 5%, 12%, 18%, and 28%, but the correct rate depends on product category and tax rules.",
                "",
                "Bad idea: setting one random GST rate for all products without checking product category.",
                "Better: use the correct GST rate confirmed by the store owner's accountant. Product-level GST can be added later when the platform needs advanced tax rules."
              ]
            },
            {
              heading: "Price Includes GST",
              content: [
                "Price Includes GST controls whether product prices already include tax.",
                "",
                "If OFF: Product Rs 100 + GST 18% = Total Rs 118.",
                "If ON: Product Rs 100 already includes GST. The customer total stays Rs 100, and the invoice shows the GST portion inside that price.",
                "",
                "Use OFF when store prices are listed before tax.",
                "Use ON when store prices are final customer-facing prices including GST."
              ]
            },
            {
              heading: "Show GST on Order Summary",
              content: [
                "Show GST on Order Summary controls whether customers see GST breakup during checkout and order summary.",
                "",
                "If ON, customers can see taxable value, GST rate, GST amount, delivery charge, and final total.",
                "If OFF, customers see the final total without GST breakup, but the order still stores GST snapshot when GST is enabled.",
                "",
                "Recommended for GST registered stores: keep it ON for transparency."
              ]
            },
            {
              heading: "Invoice Prefix and Next Invoice Number",
              content: [
                "Invoice Prefix is the text before invoice numbers. Example: INV",
                "Next Invoice Number is the next invoice sequence your store will issue.",
                "",
                "Example setup:",
                "  Invoice Prefix: INV",
                "  Next Invoice Number: 1001",
                "  First invoice: INV-001001",
                "  Next invoice: INV-001002",
                "",
                "Order number and invoice number are different. Order number is for ecommerce tracking. Invoice number is for tax/accounting records.",
                "",
                "If the business already issued invoice INV-001000 elsewhere, set Next Invoice Number to 1001 before creating GST invoices in DigitalDukandar."
              ]
            },
            {
              heading: "Why Old Orders Do Not Change",
              content: [
                "Old orders must keep the GST rate used at the time of purchase.",
                "",
                "Example old order:",
                "  Product: Rs 100",
                "  GST setting: 18%",
                "  GST: Rs 18",
                "  Total: Rs 118",
                "",
                "If the store owner changes GST to 5% after two months, the old order still shows 18%.",
                "",
                "New orders after the change use the new 5% rate.",
                "",
                "This is important because invoices are historical records. Recalculating old orders from current settings would make past invoices incorrect."
              ]
            },
            {
              heading: "How GST Appears to Customers",
              content: [
                "When GST is enabled and Show GST on Order Summary is ON, checkout shows GST details before the customer places the order.",
                "",
                "Customer summary example:",
                "  Taxable Value: Rs 100",
                "  GST (18%): Rs 18",
                "  Delivery: Rs 0",
                "  Total: Rs 118",
                "",
                "This also helps customers understand why the final amount is higher than product subtotal when prices do not include GST."
              ]
            },
            {
              heading: "How Admin Downloads GST Invoice",
              content: [
                "1. Go to Admin -> Orders.",
                "2. Open the order details.",
                "3. Click Download PDF.",
                "4. The PDF includes invoice and GST details when GST was enabled for that order.",
                "",
                "The invoice PDF can include invoice number, invoice date, GSTIN, taxable value, GST rate, GST amount, delivery charge, and final total.",
                "",
                "If an older non-GST order does not show GST fields, that is expected."
              ]
            },
            {
              heading: "GST Invoice FAQ",
              content: [
                "Q: Can I change GST percentage later?",
                "A: Yes. New orders will use the new GST percentage. Old orders keep the old GST snapshot.",
                "",
                "Q: Will old invoices change if I update GST settings?",
                "A: No. Old orders keep the GST rate, GST amount, and invoice details captured when the order was placed.",
                "",
                "Q: What is Next Invoice Number?",
                "A: It is the next invoice sequence the store will issue. Example: prefix INV and next number 1001 creates INV-001001.",
                "",
                "Q: Can I hide GST breakup from customers?",
                "A: Yes. Turn off Show GST on Order Summary. GST can still be stored on the order when GST is enabled.",
                "",
                "Q: Can admin download invoice?",
                "A: Yes. Admin can open an order and download the PDF invoice from order details.",
                "",
                "Q: Should every product use the same GST rate?",
                "A: Only if that is correct for the store's products. This phase uses one store-level GST rate. Product-level GST should be added later only when the business needs multiple tax rates."
              ]
            },
            {
              heading: "Official References",
              content: [
                "CBIC GST invoice rules: https://cbic-gst.gov.in/gst-invoice-rules.html",
                "Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
                "Google structured data introduction: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data"
              ]
            }
          ]
        },
        {
          id: "custom-domain",
          label: "Custom Domain",
          title: "Add Your Custom Domain - Complete Guide",
          description: "Connect your own domain (like yourstore.com) to your DigitalDukandar store.",
          sections: [
            {
              heading: "What You'll Need",
              content: [
                "• A custom domain (buy from GoDaddy, Namecheap, Hostinger, etc.)",
                "• A free Cloudflare account (cloudflare.com)",
                "• Your store admin access"
              ]
            },
            {
              heading: "STEP 1: Enter Domain in Your Store Admin Settings",
              content: [
                "1. Log in to your store admin panel",
                "2. Go to Settings (bottom menu)",
                "3. Scroll to 'Custom Domain' section",
                "4. Enter your domain (e.g., sasumasale.com) - without http:// or https://",
                "5. Click Save"
              ]
            },
            {
              heading: "STEP 2: Buy a Domain (if not already bought)",
              content: [
                "Buy from any registrar:",
                "  • Hostinger (hostinger.com)",
                "  • GoDaddy (godaddy.com)",
                "  • Namecheap (namecheap.com)",
                "  • BigRock (bigrock.in)"
              ]
            },
            {
              heading: "STEP 3: Create Free Cloudflare Account",
              content: [
                "1. Go to cloudflare.com → Sign Up (free)",
                "2. Click 'Add a Domain' → Enter your domain → Select Free Plan",
                "3. Cloudflare will show you 2 nameservers — copy them:",
                "   crystal.ns.cloudflare.com",
                "   edward.ns.cloudflare.com",
                "   (yours may be different — use what Cloudflare shows you)"
              ]
            },
            {
              heading: "STEP 4: Update Nameservers at Your Registrar",
              content: [
                "1. Login to where you bought the domain",
                "2. Find Nameservers / DNS Settings",
                "3. Delete old nameservers",
                "4. Add Cloudflare's nameservers (from Step 3)",
                "5. Save",
                "",
                "For GoDaddy: My Products → Domains → Manage DNS → Nameservers",
                "For Namecheap: Dashboard → Domain List → Manage → Nameservers tab",
                "For Hostinger: hPanel → Domains → DNS/Nameservers → DNS records",
                "For BigRock: My Domains → Manage → Name Servers",
                "",
                "⏱️ Wait for Cloudflare email: 'Your domain is now active' (10-30 min)"
              ]
            },
            {
              heading: "STEP 5: Add DNS Records in Cloudflare",
              content: [
                "1. Go to Cloudflare → Your Domain → DNS → Records",
                "2. Click 'Add Record' and fill in:",
                "   • Type: A",
                "   • Name: @",
                "   • IPv4 address: 147.79.70.113",
                "   • Proxy status: Orange cloud ON (Proxied)",
                "   • TTL: Auto",
                "3. Click Save",
                "",
                "4. Click 'Add Record' again for www:",
                "   • Type: CNAME",
                "   • Name: www",
                "   • Target: yourdomain.com     ( Example: sasumasale.com )",
                "   • Proxy status: Orange cloud ON (Proxied)",
                "   • TTL: Auto",
                "5. Click Save"
              ]
            },
            {
              heading: "STEP 6: Set SSL to Flexible in Cloudflare",
              content: [
                "1. Go to SSL/TLS → Overview → Configure",
                "2. Select 'Custom SSL/TLS'",
                "3. Choose 'Flexible'",
                "4. Click Save"
              ]
            },
            {
              heading: "STEP 7: Verify It's Working",
              content: [
                "1. Wait 2 to 5 minutes",
                "2. Open browser → visit https://yourdomain.com",
                "3. Your store should load with all products ✅"
              ]
            },
            {
              heading: "Troubleshooting",
              content: [
                "Still showing registrar page? → Nameservers not propagated — wait 30 min",
                "SSL error / 525 error? → SSL must be Flexible (not Full) in Cloudflare",
                "Error 1014? → You used CNAME with orange cloud — use A record instead",
                "Store not found / blank page? → Check domain saved correctly in Settings → Custom Domain",
                "www not working? → Add CNAME record for www (Step 5)"
              ]
            }
          ]
        },
        {
          id: "delivery-charges",
          label: "Delivery Charges",
          title: "Set Up Delivery Charges for Your Store",
          description: "Configure delivery fees that automatically apply at checkout for your customers.",
          sections: [
            {
              heading: "Where to Find It",
              content: [
                "1. Log in to your store admin panel",
                "2. Go to Settings (sidebar menu)",
                "3. Click 'Delivery Charges' from the dropdown",
              ]
            },
            {
              heading: "Two Modes Available",
              content: [
                "• Single Rule — One flat delivery fee with a free delivery threshold",
                "• Multiple Rules — Different fees for different order value ranges",
                "",
                "Use the toggle at the top to switch between modes.",
                "⚠️ Switching modes clears your previous settings — save before switching."
              ]
            },
            {
              heading: "Single Rule — How to Set Up",
              content: [
                "Example: Charge ₹50 delivery on all orders. Free delivery above ₹500.",
                "",
                "1. Select 'Single Rule' from the toggle",
                "2. Delivery Fee → Enter ₹50",
                "3. Free Delivery Above → Enter ₹500",
                "4. Click Save Changes",
                "",
                "Result at checkout:",
                "  • Cart below ₹500 → ₹50 delivery fee added",
                "  • Cart ₹500 or above → Free delivery",
                "",
                "Leave both fields blank → All orders get free delivery"
              ]
            },
            {
              heading: "Multiple Rules — How to Set Up",
              content: [
                "Example: Different fees for different order ranges.",
                "",
                "1. Select 'Multiple Rules' from the toggle",
                "2. Each row is one tier — fill in Min Order, Max Order, and Delivery Fee",
                "3. Click 'Add Tier' to add more ranges",
                "4. Leave Max Order blank on last tier = no upper limit",
                "5. Set Delivery Fee to 0 = free delivery for that range",
                "6. Click Save Changes",
                "",
                "Example setup:",
                "  • ₹0 – ₹199 → ₹60 fee",
                "  • ₹200 – ₹499 → ₹30 fee",
                "  • ₹500 & above → ₹0 (Free)",
                "",
                "Click the trash icon to remove any tier.",
                "You must keep at least one tier."
              ]
            },
            {
              heading: "What Customers See",
              content: [
                "• Cart page → Delivery fee shown in Order Summary",
                "• Checkout page → Delivery fee as a separate line item",
                "• If fee qualifies as free → Shows 'FREE' in green",
                "• Checkout page also shows: 'Add ₹X more for free delivery' hint",
                "",
                "Delivery fee is applied to both Cash on Delivery and Online Payment orders."
              ]
            },
            {
              heading: "Tips",
              content: [
                "✅ If you don't set any delivery charges → all orders get free delivery automatically",
                "✅ Free delivery encourages customers to add more items to their cart",
                "✅ Use Multiple Rules for flexible pricing based on order size",
                "⚠️ Only one mode (Single or Multiple) applies at a time",
                "⚠️ Always click Save Changes after updating your settings"
              ]
            }
          ]
        }
      ]
    },
    {
      id: "delhivery-seo-aeo-geo",
      title: "Delhivery Shipping Setup",
      icon: "🚚",
      content: {
        title: "Delhivery Shipping Setup Guide",
        description: "Connect Delhivery correctly, create AWB from the admin panel, refresh tracking safely, and write store content that is easier for customers and search engines to understand.",
        sections: [
          {
            heading: "What This Guide Covers",
            content: [
              "This guide is for store owners who want to use Delhivery inside DigitalDukandar and make their store easier for customers to find and understand.",
              "",
              "You will learn:",
              "  • How to set up Delhivery API token",
              "  • What Production and Staging mean",
              "  • What to enter in Client Name / HQ Name",
              "  • What to enter in Pickup Location",
              "  • How Ship via Delhivery creates AWB",
              "  • How tracking refresh works safely",
              "  • How to write better product, category, and FAQ content",
              "",
              "Important: This is one focused guide section. Do not create many thin pages for small keyword variations. One complete, useful page is stronger than many weak pages."
            ]
          },
          {
            heading: "Delhivery Setup Checklist",
            content: [
              "Before connecting Delhivery, confirm these items in Delhivery One:",
              "",
              "1. Your Delhivery account is active",
              "2. KYC and business details are completed",
              "3. Wallet has enough balance",
              "4. Pickup location is active",
              "5. Live API token is available",
              "6. Store package length, breadth, height, and weight are correct",
              "",
              "Bad idea: Copy random company text into setup fields.",
              "Better: Copy Delhivery values exactly as shown in Delhivery One."
            ]
          },
          {
            heading: "Where to Find API Token",
            content: [
              "Open Delhivery One and go to Settings -> API Setup.",
              "",
              "Use the Live API Token for real orders.",
              "Use staging only when you are testing and do not want to create real shipments.",
              "",
              "Production means real customer shipment, real AWB, and real Delhivery flow.",
              "Staging means test environment. Do not use staging for customer orders.",
              "",
              "Security rule: Never paste Delhivery API token in frontend code, browser console, screenshots, WhatsApp groups, or public documents. DigitalDukandar stores it encrypted and uses it only from server-side Supabase functions."
            ]
          },
          {
            heading: "Client Name / HQ Name",
            content: [
              "Client Name / HQ Name means the Delhivery account or client name assigned to your Delhivery account.",
              "",
              "Where to find it:",
              "  • Open Delhivery One",
              "  • Check the top-right account selector",
              "  • Look under Domestic",
              "",
              "In DigitalDukandar, enter this value exactly.",
              "",
              "Common confusion: Store owners may think this field means company name or pickup address. It does not. It should match the Delhivery account/client name."
            ]
          },
          {
            heading: "Pickup Location",
            content: [
              "Pickup Location means the active pickup location name inside Delhivery One.",
              "",
              "Where to find it:",
              "  • Open Delhivery One",
              "  • Go to Settings -> Pickup Locations",
              "  • Copy the active pickup location name exactly",
              "",
              "Do not paste full pickup address in this field unless Delhivery itself shows the full address as the pickup location name.",
              "",
              "Example mistake: Entering 'Ward No. 12 Khairthal Siwan Road...' when Delhivery expects the pickup location name.",
              "Correct approach: Enter the active pickup location name exactly as Delhivery shows it."
            ]
          },
          {
            heading: "How Ship via Delhivery Works",
            content: [
              "When admin clicks Ship via Delhivery from Orders:",
              "",
              "1. DigitalDukandar verifies the store owner and order",
              "2. It checks Delhivery integration and package details",
              "3. It calls Delhivery from the server, not the browser",
              "4. Delhivery creates the shipment and returns AWB",
              "5. DigitalDukandar saves courier name, AWB, shipping status, and tracking URL",
              "6. Store owner can see shipping details inside the order",
              "",
              "AWB means tracking number or waybill number.",
              "Manifested means the shipment is created with Delhivery. It does not always mean picked up."
            ]
          },
          {
            heading: "Tracking Page and Manual Refresh",
            content: [
              "Customers should use the DigitalDukandar tracking page, not the Delhivery public tracking page.",
              "",
              "Reason: Delhivery public tracking can ask the customer for phone number. DigitalDukandar tracking page is cleaner for customer experience.",
              "",
              "Safe refresh rules for current scale and Supabase Free:",
              "  • Customer tracking page reads saved status from database",
              "  • It should not call Delhivery every time customer opens page",
              "  • Admin can refresh a single order manually",
              "  • Admin can use manual bulk refresh when needed",
              "",
              "Manual bulk refresh rules:",
              "  • Only Delhivery shipments",
              "  • Only active shipments",
              "  • Only last 20 days",
              "  • Skip delivered, cancelled, returned, and RTO",
              "  • Batch 30 AWBs per Delhivery API call",
              "  • Rate limit refresh actions",
              "",
              "Bad idea: Automatic cron every few minutes on Supabase Free.",
              "Better: Manual admin refresh now, webhook or paid scheduled fallback later."
            ]
          },
          {
            heading: "Make Your Store Easier to Find",
            content: [
              "Good store content helps customers, Google, and AI search tools understand what you sell.",
              "",
              "Write clear answers to real buyer questions like 'What is this product used for?', 'Is COD available?', 'How many days for delivery?', and 'Is this safe for daily use?'",
              "",
              "Mention delivery, returns, ingredients, material, size, warranty, city, and service area only when those details are true.",
              "",
              "Simple rule: Write for customers first. Make every product and category clear enough that a buyer can understand it without guessing."
            ]
          },
          {
            heading: "Store Content Checklist",
            content: [
              "Product title: Use product type + main benefit + brand or use case.",
              "Example: Herbal Hair Oil for Hair Fall Control - 100ml",
              "",
              "Product description: Explain who it is for, benefits, ingredients/material, size, usage, delivery, and COD availability.",
              "",
              "Category names: Use words buyers search for. Example: Herbal Hair Care, Ayurvedic Skin Care, Handmade Gifts.",
              "",
              "FAQs: Add real customer questions. Example: Is COD available? How many days for delivery? Is this product safe for daily use?",
              "",
              "Local SEO: Mention city, state, and delivery area only when true. Do not add fake city names just for ranking.",
              "",
              "Images: Use clear product photos and meaningful alt text. Do not upload dark, blurry, or duplicate images.",
              "",
              "Bad idea: Keyword stuffing like 'best hair oil India best hair oil online best hair oil buy now'.",
              "Better: One clear product title, useful description, price, stock, shipping info, and FAQ."
            ]
          },
          {
            heading: "Keyword Research Map",
            content: [
              "Use these keywords naturally inside this guide, product descriptions, FAQs, and admin help text. Do not repeat them unnaturally.",
              "",
              "Delhivery setup keywords:",
              "  • Delhivery API token setup",
              "  • Delhivery Client Name HQ Name",
              "  • Delhivery pickup location setup",
              "  • connect Delhivery to ecommerce store",
              "",
              "Shipping and tracking keywords:",
              "  • create Delhivery AWB",
              "  • Delhivery manifested status meaning",
              "  • ecommerce shipping tracking India",
              "  • customer tracking page",
              "",
              "Store visibility keywords:",
              "  • product SEO for ecommerce store",
              "  • clear ecommerce product description",
              "  • product FAQ for online store",
              "  • local SEO for online store India"
            ]
          },
          {
            heading: "Troubleshooting",
            content: [
              "Problem: shipment list contains no data.",
              "Fix: Check Client Name / HQ Name and Pickup Location. Use exact Delhivery values.",
              "",
              "Problem: AWB is created but status stays manifested.",
              "Fix: This is normal before pickup/scans. Refresh tracking after pickup movement.",
              "",
              "Problem: Customer tracking asks for phone number.",
              "Fix: Share DigitalDukandar tracking page instead of Delhivery public page.",
              "",
              "Problem: Token stopped working.",
              "Fix: If you regenerate Delhivery live token, update it in DigitalDukandar immediately.",
              "",
              "Problem: SEO is not improving.",
              "Fix: Improve product titles, descriptions, FAQs, image quality, internal links, and category names. Do not rely on keyword stuffing."
            ]
          },
          {
            heading: "Official References",
            content: [
              "Delhivery API Token: https://help.delhivery.com/docs/api-token-generation",
              "Delhivery Integration Prerequisites: https://delhivery-express-api-doc.readme.io/reference/must-to-have-for-integration",
              "Delhivery Tracking API: https://one.delhivery.com/developer-portal/document/b2c/detail/order-tracking",
              "Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
              "Google AI Optimization Guide: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide"
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
      id: "bdm",
      title: "Business Development Manager",
      icon: "👥",
      content: {
        title: "Business Development Manager",
        description: "Coming soon: Build your referral and BDM network.",
        sections: [
          {
            heading: "Coming Soon",
            content: "This section is under development. Check back soon for comprehensive BDM program guides."
          }
        ]
      },
      disabled: true
    }
  ];

  const activeMenuItem = menuItems.find(item => item.id === activeMenu);

  // Handle both new subOptions and old content structure
  const getActiveSection = () => {
    if (!activeMenu || !activeMenuItem) return null;

    if (activeMenuItem.subOptions) {
      const selected = activeMenuItem.subOptions.find(opt => opt.id === activeSubOption);
      if (!selected && activeMenuItem.subOptions.length > 0) {
        setActiveSubOption(activeMenuItem.subOptions[0].id);
        return activeMenuItem.subOptions[0];
      }
      return selected;
    }

    return activeMenuItem.content ? { ...activeMenuItem.content, sections: activeMenuItem.content.sections } : null;
  };

  const activeSection = getActiveSection();

  // Real-time search filtering
  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;

    const query = searchQuery.toLowerCase();
    return menuItems.filter(item => {
      // Check item title
      if (item.title.toLowerCase().includes(query)) return true;

      // If item has content (old style), search within it
      if (item.content) {
        if (item.content.title.toLowerCase().includes(query)) return true;
        if (item.content.description.toLowerCase().includes(query)) return true;
        if (item.content.sections.some(section =>
          section.heading.toLowerCase().includes(query) ||
          (typeof section.content === 'string' && section.content.toLowerCase().includes(query)) ||
          (Array.isArray(section.content) && section.content.some(c => c.toLowerCase().includes(query)))
        )) return true;
      }

      // If item has subOptions (new style like Settings), search within it
      if (item.subOptions && item.subOptions.length > 0) {
        return item.subOptions.some(option =>
          option.label.toLowerCase().includes(query) ||
          option.title.toLowerCase().includes(query) ||
          option.description.toLowerCase().includes(query) ||
          option.sections.some(section =>
            section.heading.toLowerCase().includes(query) ||
            (typeof section.content === 'string' && section.content.toLowerCase().includes(query)) ||
            (Array.isArray(section.content) && section.content.some(c => c.toLowerCase().includes(query)))
          )
        );
      }

      return false;
    });
  }, [searchQuery, menuItems]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <style>{scrollbarHideStyles}</style>
      <Helmet>
        <title>GST Invoice Setup Guide for Online Store India | DigitalDukandar</title>
        <meta name="description" content="Learn how to set GSTIN, GST percentage, invoice prefix, next invoice number, customer GST summary, and admin invoice download for your DigitalDukandar online store in India." />
        <meta name="keywords" content="GST invoice setup online store India, GST settings ecommerce store, GSTIN setup ecommerce website, invoice number setup online orders, GST invoice download" />
        <meta property="og:title" content="GST Invoice Setup Guide for Online Store India | DigitalDukandar" />
        <meta property="og:description" content="Step-by-step GST and invoice setup guide for DigitalDukandar store owners in India." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="GST Invoice Setup Guide for Online Store India | DigitalDukandar" />
        <meta name="twitter:description" content="Set GSTIN, GST rate, invoice sequence, GST summary, and PDF invoice download correctly." />
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
                placeholder="Search GST, invoice number, GSTIN..."
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
            "w-72 lg:w-80 flex-shrink-0 transition-all duration-300 ease-in-out relative",
            sidebarOpen ? "block" : "hidden"
          )}>
            {/* Sliding Bar - Outside scroll container */}
            <div
              className="absolute left-0 w-2 bg-gradient-to-b from-primary via-primary to-primary/80 rounded-r-lg z-10 shadow-md shadow-primary/40"
              style={{
                top: `calc(120px + ${barPosition}px)`,
                height: `${barHeight}px`,
                opacity: activeMenu ? 1 : 0,
              }}
            />

            <div className="sticky top-[120px] space-y-3 max-h-[calc(100vh-140px)] overflow-y-auto pr-3 hide-scrollbar" ref={menuContainerRef}>

              <div className="mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 mb-3">
                  Guide Topics
                </h2>
              </div>

              {filteredMenuItems.map((item, index) => (
                <div key={item.id} style={{ animationDelay: `${index * 0.05}s` }} className="animate-fade-in-up">
                  {/* Main Menu Item */}
                  <button
                    ref={(el) => {
                      if (el) menuItemsRef.current[item.id] = el;
                    }}
                    onClick={() => {
                      handleMenuClick(item.id);
                    }}
                    disabled={item.disabled}
                    className={cn(
                      "w-full text-left px-5 py-4 rounded-xl transition-all duration-300 flex items-center justify-between group menu-item-hover",
                      activeMenu === item.id
                        ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                        : "hover:bg-muted/80 text-foreground/90 hover:text-foreground border border-border/30 hover:border-border/50 hover:shadow-md",
                      item.disabled && "opacity-50 cursor-not-allowed hover:transform-none"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xl">{item.icon}</span>
                      <span className="font-medium text-[15px]">{item.title}</span>
                    </span>
                    {item.disabled ? (
                      <Lock className="w-3.5 h-3.5 opacity-50" />
                    ) : item.subOptions && item.subOptions.length > 0 ? (
                      <ChevronRight className={cn(
                        "w-4 h-4 transition-transform duration-300",
                        activeMenu === item.id && "rotate-90"
                      )} />
                    ) : activeMenu === item.id ? (
                      <ChevronRight className="w-4 h-4 ml-auto transition-transform group-hover:translate-x-1" />
                    ) : null}
                  </button>

                  {/* Sub-Options Dropdown (only for items with subOptions) */}
                  {item.subOptions && item.subOptions.length > 0 && activeMenu === item.id && (
                    <div className="mt-2 ml-2 pl-4 border-l-2 border-primary/30 space-y-2">
                      {item.subOptions.map((subOption) => (
                        <button
                          key={subOption.id}
                          onClick={() => setActiveSubOption(subOption.id)}
                          className={cn(
                            "w-full text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium",
                            activeSubOption === subOption.id
                              ? "bg-primary/20 text-primary border border-primary/50"
                              : "text-foreground/70 hover:text-foreground hover:bg-muted/50 border border-transparent hover:border-border/50"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-current" />
                            {subOption.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                    {activeSection?.title}
                  </h1>
                  <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                    {activeSection?.description}
                  </p>
                </div>

                {activeMenuItem?.disabled ? (
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
                    {activeSection?.sections?.map((section, idx) => (
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

                              if (item.startsWith("__image:")) {
                                const src = item.replace("__image:", "");
                                return (
                                  <img
                                    key={i}
                                    src={src}
                                    alt="guide screenshot"
                                    className="rounded-lg border border-border shadow-sm max-w-full w-full my-2"
                                  />
                                );
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
                {!activeMenuItem?.disabled && (
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
