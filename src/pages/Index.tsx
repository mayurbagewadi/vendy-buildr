import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLandingAnimations } from "@/hooks/useLandingAnimations";
import { FloatingParticles } from "@/components/landing/FloatingParticles";
import { AnimatedText } from "@/components/landing/AnimatedText";
import { GradientBlob } from "@/components/landing/GradientBlob";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShoppingBag,
  Store,
  Sparkles,
  ArrowRight,
  Zap,
  Shield,
  Smartphone,
  BarChart3,
  Package,
  Check,
  Crown,
  TrendingUp,
  Globe,
  Heart,
  Star,
  Menu,
  X,
  UserPlus,
  DollarSign,
  Users,
  Target,
  Link2,
  Image,
  Video,
  MessageCircle,
  CreditCard,
  Search,
  Instagram,
  MessageSquare,
  Boxes,
  ClipboardList,
  Play,
  LineChart,
  Percent,
  AlertCircle
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AppLogo } from "@/components/ui/AppLogo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const Index = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { heroRef, featuresRef, stepsRef } = useLandingAnimations();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAccountDeletedDialog, setShowAccountDeletedDialog] = useState(false);

  // Check for account deleted error and show dialog
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'account_deleted') {
      setShowAccountDeletedDialog(true);
      // Remove the error param from URL without triggering navigation
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const features = [
    {
      icon: Link2,
      title: "Free Subdomain",
      description: "Get your own professional subdomain instantly. Launch your store without any domain costs.",
      gradient: "from-blue-500 to-cyan-500",
      size: "normal"
    },
    {
      icon: Image,
      title: "Banner & Carousel",
      description: "Showcase offers with stunning banners and auto-rotating carousels that grab attention.",
      gradient: "from-purple-500 to-pink-500",
      size: "normal"
    },
    {
      icon: Video,
      title: "Product Videos",
      description: "Engage customers with high-quality product videos that boost conversions.",
      gradient: "from-rose-500 to-orange-500",
      size: "normal"
    },
    {
      icon: MessageCircle,
      title: "WhatsApp Integration",
      description: "Receive orders directly on WhatsApp. Chat with customers in real-time instantly.",
      gradient: "from-green-500 to-emerald-500",
      size: "normal"
    },
    {
      icon: CreditCard,
      title: "Online Payments",
      description: "Accept direct payments online with secure, trusted payment gateways.",
      gradient: "from-indigo-500 to-blue-500",
      size: "normal"
    },
    {
      icon: Search,
      title: "SEO & Indexing",
      description: "Get found on Google with built-in SEO optimization and automatic indexing.",
      gradient: "from-yellow-500 to-orange-500",
      size: "normal"
    },
    {
      icon: MessageSquare,
      title: "Instagram Auto-Reply",
      description: "Never miss a customer inquiry with intelligent Instagram auto-reply features.",
      gradient: "from-pink-500 to-rose-500",
      size: "normal"
    },
    {
      icon: Star,
      title: "Google Reviews",
      description: "Display authentic Google Reviews on your site to build trust and credibility.",
      gradient: "from-amber-500 to-yellow-500",
      size: "normal"
    },
    {
      icon: Users,
      title: "Advanced CRM",
      description: "Manage customer relationships with powerful CRM tools for growth.",
      gradient: "from-teal-500 to-cyan-500",
      size: "normal"
    },
    {
      icon: Boxes,
      title: "Stock Management",
      description: "Track inventory in real-time. Never oversell with smart stock alerts.",
      gradient: "from-violet-500 to-purple-500",
      size: "normal"
    },
    {
      icon: Instagram,
      title: "Instagram Videos",
      description: "Embed Instagram videos directly on your website for better engagement.",
      gradient: "from-fuchsia-500 to-pink-500",
      size: "normal",
      comingSoon: true
    },
    {
      icon: LineChart,
      title: "Business Analytics",
      description: "Advanced insights into sales, customers, and trends. Make data-driven decisions.",
      gradient: "from-emerald-500 to-teal-500",
      size: "normal"
    },
    {
      icon: ClipboardList,
      title: "Order Management",
      description: "Streamline order processing from checkout to delivery with ease.",
      gradient: "from-sky-500 to-blue-500",
      size: "normal"
    },
    {
      icon: Percent,
      title: "Discounts",
      description: "Create flexible discounts with percentage, fixed amounts, or tiered pricing. Boost sales automatically.",
      gradient: "from-red-500 to-orange-500",
      size: "normal"
    },
    {
      icon: CreditCard,
      title: "Coupons",
      description: "Generate unique coupon codes and track redemptions. Perfect for referrals and loyalty programs.",
      gradient: "from-purple-500 to-pink-500",
      size: "normal"
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Sign Up",
      description: "Create your account in seconds with Google"
    },
    {
      number: "02",
      title: "Add Products",
      description: "Build your product catalog easily"
    },
    {
      number: "03",
      title: "Customize",
      description: "Brand your store with colors and logo"
    },
    {
      number: "04",
      title: "Go Live",
      description: "Share your store link and start selling"
    }
  ];

  // SEO Schema - Organization (for Google Knowledge Panel)
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "DigitalDukandar",
    "url": "https://digitaldukandar.in",
    "logo": "https://digitaldukandar.in/logo.png",
    "description": "Free ecommerce website builder. Create your online store in minutes with AI designer, WhatsApp integration, custom domain, and powerful analytics. No coding required.",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "availableLanguage": ["English", "Hindi"]
    },
    "sameAs": [
      "https://www.instagram.com/digitaldukandar",
      "https://www.facebook.com/digitaldukandar",
      "https://twitter.com/digitaldukandar"
    ],
    "foundingDate": "2024"
  };

  // SEO Schema - SoftwareApplication
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "DigitalDukandar",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "INR",
      "description": "Free 14-day trial, no credit card required"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "10000",
      "bestRating": "5",
      "worstRating": "1"
    },
    "description": "Build your ecommerce website in minutes. Free online store builder with AI designer, WhatsApp integration, payments and analytics. No coding required. Best Shopify alternative.",
    "url": "https://digitaldukandar.in",
    "image": "https://digitaldukandar.in/logo.png",
    "provider": {
      "@type": "Organization",
      "name": "DigitalDukandar",
      "url": "https://digitaldukandar.in"
    }
  };

  return (
    <div className="min-h-screen bg-background font-inter">
      {/* Account Deleted Dialog */}
      <AlertDialog open={showAccountDeletedDialog} onOpenChange={setShowAccountDeletedDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-xl font-bold">
              Account Deleted
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center pt-4 text-base">
              Your account has been deleted by the platform administrator. All your data has been permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-center">
            <Button
              onClick={() => setShowAccountDeletedDialog(false)}
              className="w-full sm:w-auto px-8"
            >
              OK
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SEO Meta Tags */}
      <Helmet>
        {/* Primary Meta Tags */}
        <title>DigitalDukandar — Free Ecommerce Website Builder | Create Online Store &amp; Sell Online</title>
        <meta name="title" content="DigitalDukandar — Free Ecommerce Website Builder | Create Online Store & Sell Online" />
        <meta name="description" content="Build your ecommerce website in minutes. Free online store builder with AI designer, WhatsApp integration, payments & analytics. Trusted by 10,000+ store owners. No coding needed. Start free — no credit card required." />
        <meta name="keywords" content="ecommerce website builder, create online store, build ecommerce website, sell online, best ecommerce platform, free online store, online store builder, ecommerce platform, AI ecommerce website builder, no code online store, whatsapp ecommerce, free ecommerce platform, shopify alternative, start selling online, ecommerce platform for small business, ecommerce website builder free, whatsapp store builder, free shopify alternative, cheap ecommerce platform, ecommerce platform for beginners, build online store free, no transaction fee ecommerce, sell online free, AI online store builder, woocommerce alternative, bigcommerce alternative, squarespace alternative, ecommerce platform comparison, small business online store, dropshipping website builder, mobile ecommerce platform, custom domain online store, sell products online, online selling platform, ecommerce store builder, website builder with ecommerce, free website with online store, sell online without fees, ecommerce website free, start online store, ecommerce builder, no code ecommerce builder, online shop builder, ecommerce site builder, create ecommerce website, ecommerce website for small business, free online shop, sell online for free, best free online store builder, ecommerce platform with whatsapp, whatsapp order management, AI store designer, ecommerce analytics, inventory management ecommerce, coupon code ecommerce, discount management online store" />
        <link rel="canonical" href="https://digitaldukandar.in" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://digitaldukandar.in" />
        <meta property="og:title" content="DigitalDukandar — Free Ecommerce Website Builder | Create Online Store" />
        <meta property="og:description" content="Build your ecommerce website in minutes. AI-powered online store builder with WhatsApp integration, custom domain & analytics. Trusted by 10,000+ store owners. Start free!" />
        <meta property="og:image" content="https://digitaldukandar.in/logo.png" />
        <meta property="og:site_name" content="DigitalDukandar" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://digitaldukandar.in" />
        <meta name="twitter:title" content="DigitalDukandar — Free Ecommerce Website Builder | Create Online Store" />
        <meta name="twitter:description" content="Build your ecommerce website in minutes. AI-powered store builder with WhatsApp integration, payments & analytics. 10,000+ store owners trust us. Start free!" />
        <meta name="twitter:image" content="https://digitaldukandar.in/logo.png" />

        {/* Additional SEO */}
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow" />
        <meta name="language" content="English" />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />

        {/* Structured Data - Organization */}
        <script type="application/ld+json">
          {JSON.stringify(organizationSchema)}
        </script>
        {/* Structured Data - SoftwareApplication */}
        <script type="application/ld+json">
          {JSON.stringify(softwareSchema)}
        </script>
        {/* Structured Data - FAQPage */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "What is the best ecommerce website builder?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "This is a top-rated free ecommerce website builder that lets you create a professional online store in minutes. It includes AI-powered design, WhatsApp integration, payment processing, and analytics — no coding required."
                }
              },
              {
                "@type": "Question",
                "name": "Can I create an online store for free?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. We offer a free 14-day trial with no credit card required. You get a free subdomain, full ecommerce features, and AI store designer from day one."
                }
              },
              {
                "@type": "Question",
                "name": "How do I build an ecommerce website?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "You can build an ecommerce website in 4 steps: (1) Sign up with Google, (2) Add your products, (3) Customize your store with the AI designer, (4) Go live and start selling. The whole process takes under 5 minutes."
                }
              },
              {
                "@type": "Question",
                "name": "What ecommerce platform is best for small business?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "This platform is built for small businesses. It offers affordable plans, WhatsApp order integration, inventory management, discount coupons, and built-in SEO — everything a small business needs to sell online without technical skills."
                }
              },
              {
                "@type": "Question",
                "name": "Is this a good Shopify alternative?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. This is a powerful Shopify alternative with an AI store designer, WhatsApp integration, custom domain support, and plans starting at a fraction of Shopify's price. Ideal for entrepreneurs who want to sell online without high fees."
                }
              },
              {
                "@type": "Question",
                "name": "Does this platform have WhatsApp ecommerce integration?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. The platform has native WhatsApp integration that lets customers place orders directly via WhatsApp — making it the best ecommerce platform for businesses that sell through messaging apps."
                }
              },
              {
                "@type": "Question",
                "name": "How does an AI ecommerce website builder work?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "An AI ecommerce website builder uses artificial intelligence to automatically design your store. You describe your brand or choose a style, and the AI generates colors, layouts, and themes instantly — no designer or coding needed. You can then customize and publish in minutes."
                }
              },
              {
                "@type": "Question",
                "name": "Are there ecommerce platforms with no transaction fees?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. This platform charges no transaction fees on any plan. Unlike Shopify, which charges 0.5–2% per sale unless you use Shopify Payments, you keep 100% of every sale you make. This makes it one of the most cost-effective ecommerce platforms for small businesses."
                }
              },
              {
                "@type": "Question",
                "name": "What is the best ecommerce platform for beginners?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "The best ecommerce platform for beginners requires no coding, sets up in minutes, and includes payments, inventory, SEO, and analytics out of the box. This platform is built for beginners with a drag-and-drop builder and AI-powered store design."
                }
              },
              {
                "@type": "Question",
                "name": "Can I start an online store with no money?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. A free 14-day trial is available with no credit card required. You get a free subdomain, full ecommerce features, WhatsApp integration, and an AI designer at zero cost. Paid plans only start after the trial."
                }
              },
              {
                "@type": "Question",
                "name": "What is the cheapest way to build an ecommerce website?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "The cheapest way to build an ecommerce website is to use a free ecommerce platform with no transaction fees. Starting with a free trial and zero transaction fees costs nothing until you scale — far cheaper than Shopify ($29/month + up to 2% fees) or WooCommerce (hosting + plugins)."
                }
              },
              {
                "@type": "Question",
                "name": "Which ecommerce platform is better than Shopify for small business?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "For small businesses, platforms with no transaction fees, a free plan, WhatsApp integration, and an AI designer offer better value than Shopify. Shopify charges $29–$299/month plus up to 2% per transaction — costs that add up fast for small online stores."
                }
              },
              {
                "@type": "Question",
                "name": "Can I sell online without a website?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. With WhatsApp ecommerce integration, customers can place orders directly through WhatsApp — no separate website required. You can also share your store link on Instagram or Facebook to sell online instantly without a traditional website."
                }
              }
            ]
          })}
        </script>
        {/* Structured Data - HowTo */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": "How to Create an Online Store in Minutes",
            "description": "Build your ecommerce website in 4 simple steps. No coding required.",
            "totalTime": "PT5M",
            "step": [
              {
                "@type": "HowToStep",
                "position": 1,
                "name": "Sign Up",
                "text": "Create your free account in seconds with Google. No credit card required."
              },
              {
                "@type": "HowToStep",
                "position": 2,
                "name": "Add Products",
                "text": "Build your product catalog easily. Add images, prices, and descriptions."
              },
              {
                "@type": "HowToStep",
                "position": 3,
                "name": "Customize Your Store",
                "text": "Brand your store with the AI designer — choose colors, logo, and layout."
              },
              {
                "@type": "HowToStep",
                "position": 4,
                "name": "Go Live & Sell",
                "text": "Share your store link and start selling online immediately."
              }
            ]
          })}
        </script>
      </Helmet>

      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-3 sm:gap-4 group flex-shrink-0" aria-label="DigitalDukandar Home">
            <AppLogo size={40} className="transition-transform group-hover:scale-105" />
            <span className="font-playfair font-bold text-2xl sm:text-3xl md:text-4xl bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              DigitalDukandar
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </a>
            <Link to="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <a href="#helper-program" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              For Helpers
            </a>
            <Link to="/guide" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Guide
            </Link>
          </nav>
          
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <ThemeToggle />

            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-11 w-11 min-h-[44px]"
                  aria-label="Open menu"
                  aria-expanded={mobileMenuOpen}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-primary" />
                    Menu
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-4 mt-8" aria-label="Mobile navigation">
                  <a
                    href="#features"
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-3 border-b"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Features
                  </a>
                  <a
                    href="#how-it-works"
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-3 border-b"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    How It Works
                  </a>
                  <Link
                    to="/pricing"
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-3 border-b"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Pricing
                  </Link>
                  <a
                    href="#helper-program"
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-3 border-b"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    For Helpers
                  </a>
                  <Link
                    to="/guide"
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-3 border-b"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Guide
                  </Link>
                  <div className="flex flex-col gap-3 mt-6">
                    <Link to="/auth" className="w-full">
                      <Button variant="outline" size="lg" className="w-full h-12 min-h-[48px]">
                        Login
                      </Button>
                    </Link>
                    <Link to="/auth" className="w-full">
                      <Button size="lg" className="w-full h-12 min-h-[48px]">
                        Get Started Free
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>

            {/* Desktop Auth Buttons */}
            <Link to="/auth" className="hidden md:inline-block">
              <Button variant="ghost" size="sm" className="font-medium h-11 px-4 text-sm min-h-[44px]">
                Login
              </Button>
            </Link>
            <Link to="/auth" className="hidden md:inline-block">
              <Button size="sm" className="shadow-lg hover:shadow-xl transition-all font-medium h-11 px-4 text-sm min-h-[44px]">
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative overflow-hidden bg-gradient-to-b from-background via-primary/[0.02] to-background">
        {/* Floating Particles */}
        <FloatingParticles />

        {/* Gradient Blobs - Multiple layers for depth */}
        <GradientBlob color="blue" size="lg" position={{ top: '-20%', right: '-10%' }} />
        <GradientBlob color="purple" size="md" position={{ bottom: '-15%', left: '-5%' }} />
        <GradientBlob color="pink" size="md" position={{ top: '30%', left: '50%' }} />

        {/* Decorative Elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="hero-decorative absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20" />
        <div className="hero-decorative absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20" />
        
        <div className="container relative mx-auto px-4 lg:px-8 py-24 lg:py-36">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="hero-badge inline-flex items-center gap-2 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 text-primary px-5 py-2.5 rounded-full text-sm font-semibold mb-8 shadow-lg backdrop-blur-sm">
              <Star className="w-4 h-4 fill-primary" />
              Trusted by 10,000+ Entrepreneurs Worldwide
              <Sparkles className="w-4 h-4" />
            </div>

            {/* Main Heading */}
            <div className="hero-heading mb-6">
              <AnimatedText
                text="Free Online Store"
                as="h1"
                className="font-playfair text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-foreground leading-[1.1]"
                delay={0.3}
              />
              <AnimatedText
                text="Launch in 5 Minutes"
                as="span"
                className="font-playfair text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.1] mt-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient"
                delay={0.6}
                gradient
              />
            </div>

            {/* Subheading */}
            <p className="hero-subheading text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed font-light">
              Build your ecommerce website in minutes. Sell online with AI-powered design, WhatsApp integration, custom domain, and powerful analytics. No coding required — start your free online store today.
            </p>

            {/* CTA Buttons */}
            <div className="hero-cta flex flex-col sm:flex-row gap-5 justify-center items-center mb-12">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto h-14 px-10 text-base shadow-2xl hover:shadow-primary/25 transition-all group font-semibold">
                  <Crown className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Start Building Free
                </Button>
              </Link>
              <Link to="/demo" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-10 text-base border-2 hover:bg-muted/50 font-semibold">
                  <Globe className="w-5 h-5 mr-2" />
                  Explore Demo Store
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="hero-trust flex flex-wrap justify-center items-center gap-8 text-sm font-medium">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <span>Setup in 5 minutes</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <span>Cancel anytime</span>
              </div>
            </div>

            {/* Social Proof */}
            <div className="mt-16 flex justify-center items-center gap-3 text-sm text-muted-foreground animate-in fade-in duration-700 delay-700">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-background flex items-center justify-center">
                    <Heart className="w-4 h-4 text-primary" />
                  </div>
                ))}
              </div>
              <span className="font-medium">Join thousands of successful store owners</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section ref={featuresRef} id="features" className="container mx-auto px-4 lg:px-8 py-24 lg:py-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-block mb-4">
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">Premium Features</span>
            </div>
            <h2 className="font-playfair text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Unique & Powerful Features
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Powerful features designed to help you launch, manage, and grow your online business with elegance and ease.
            </p>
          </div>
          
          {/* Bento-box grid layout with varying sizes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className={`feature-card relative p-6 lg:p-8 hover:shadow-2xl transition-all duration-700 border-0 bg-gradient-to-br from-card to-card/50 backdrop-blur group overflow-hidden hover:-translate-y-2 hover:scale-[1.02]`}
                style={{
                  animationDelay: `${index * 50}ms`
                }}
              >
                {/* Animated gradient overlay - 50% without hover, 100% with hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-5 group-hover:opacity-20 transition-all duration-700`} />

                {/* Animated border glow - 50% without hover, 100% with hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-5 group-hover:opacity-20 blur-xl transition-all duration-700`} />

                {/* Decorative corner accent */}
                <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${feature.gradient} opacity-5 rounded-bl-[100px] group-hover:opacity-10 transition-opacity duration-500`} />

                {/* Coming Soon Badge */}
                {feature.comingSoon && (
                  <div className="absolute top-3 right-3 z-20">
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-lg`}>
                      Coming Soon
                    </div>
                  </div>
                )}

                <div className="relative z-10 h-full flex flex-col">
                  {/* Icon with animated background - reduced glow by 50% */}
                  <div className="mb-4 lg:mb-6">
                    <div className={`relative inline-block`}>
                      <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} rounded-2xl blur-sm opacity-20 group-hover:blur-md group-hover:opacity-30 transition-all duration-500`} />
                      <div className={`relative w-14 h-14 lg:w-16 lg:h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                        <feature.icon className="w-7 h-7 lg:w-8 lg:h-8 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Title - kept simple, readable, with subtle hover effect */}
                  <h3 className={`font-bold mb-2 lg:mb-3 text-foreground transition-all duration-300 text-lg lg:text-xl`}>
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className={`text-muted-foreground leading-relaxed flex-grow text-sm lg:text-base`}>
                    {feature.description}
                  </p>

                  {/* Hover indicator */}
                  <div className="mt-4 flex items-center gap-2 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                    <span className={`bg-gradient-to-br ${feature.gradient} bg-clip-text text-transparent`}>
                      Learn more
                    </span>
                    <ArrowRight className={`w-4 h-4 bg-gradient-to-br ${feature.gradient} text-transparent group-hover:translate-x-1 transition-transform duration-300`} style={{
                      background: `linear-gradient(to bottom right, currentColor, currentColor)`,
                      WebkitBackgroundClip: 'text'
                    }} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section ref={stepsRef} id="how-it-works" className="relative bg-gradient-to-b from-muted/30 via-muted/20 to-background py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <div className="inline-block mb-4">
                <span className="text-sm font-semibold text-primary uppercase tracking-wider">Simple Process</span>
              </div>
              <h2 className="font-playfair text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
                How It Works
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Launch your luxury online store in four elegant steps
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
              {steps.map((step, index) => (
                <div key={index} className="step-card relative">
                  <div className="text-center group">
                    <div className="relative inline-block mb-6">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60 rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                      <div className="relative w-20 h-20 bg-gradient-to-br from-primary via-primary to-primary/80 border-2 border-primary/30 rounded-3xl flex items-center justify-center shadow-xl group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300">
                        <span className="font-playfair font-bold text-3xl text-primary-foreground">
                          {step.number}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-playfair font-bold text-2xl mb-3 text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Helper Program Section */}
      <section id="helper-program" className="relative bg-gradient-to-b from-background via-green-500/5 to-background py-24 lg:py-32 overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-green-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-green-500/10 rounded-full blur-3xl opacity-20" />

        <div className="container relative mx-auto px-4 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-block mb-4">
                <span className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">Helper Program</span>
              </div>
              <h2 className="font-playfair text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
                Earn While Helping Others Succeed
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Join our helper program and earn generous commissions by helping store owners build their online businesses
              </p>
            </div>

            {/* Benefits Grid */}
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              <Card className="p-8 text-center hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border-0 bg-gradient-to-br from-card to-card/50 backdrop-blur group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 opacity-0 group-hover:opacity-5 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300 mx-auto">
                    <DollarSign className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-playfair font-bold text-xl mb-3 text-foreground">
                    Earn Commission
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Get 10% direct commission + 5% network commission on every successful store signup
                  </p>
                </div>
              </Card>

              <Card className="p-8 text-center hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border-0 bg-gradient-to-br from-card to-card/50 backdrop-blur group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-5 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300 mx-auto">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-playfair font-bold text-xl mb-3 text-foreground">
                    Build Your Network
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Recruit other helpers and earn from their referrals too. Create passive income streams
                  </p>
                </div>
              </Card>

              <Card className="p-8 text-center hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border-0 bg-gradient-to-br from-card to-card/50 backdrop-blur group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 opacity-0 group-hover:opacity-5 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300 mx-auto">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-playfair font-bold text-xl mb-3 text-foreground">
                    Flexible Work
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Work on your own schedule. Help businesses online from anywhere in the world
                  </p>
                </div>
              </Card>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
              <Link to="/become-helper" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto h-14 px-10 text-base shadow-2xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all group font-semibold"
                >
                  <UserPlus className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Apply to Become a Helper
                </Button>
              </Link>
              <Link to="/application-status" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto h-14 px-10 text-base border-2 hover:bg-muted/50 font-semibold"
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Check Application Status
                </Button>
              </Link>
            </div>

            {/* Additional Info */}
            <div className="mt-12 text-center">
              <p className="text-sm text-muted-foreground">
                Already a helper? <Link to="/helper/login" className="text-primary font-semibold hover:underline">Login here</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who Is This For Section */}
      <section className="container mx-auto px-4 lg:px-8 py-24 lg:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block mb-4">
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">For Every Seller</span>
            </div>
            <h2 className="font-playfair text-4xl md:text-5xl font-bold text-foreground mb-6">
              The Online Store Builder for Every Business
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Whether you're a first-time seller or scaling an existing brand, our <strong>ecommerce platform</strong> has everything you need to <strong>sell online</strong>
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                emoji: "🛍️",
                title: "First-Time Sellers",
                desc: "Never sold online before? Our no-code ecommerce website builder guides you from zero to live store in under 5 minutes. No technical skills, no designer, no developer needed.",
                tags: ["No-code setup", "AI designer", "Free trial"]
              },
              {
                emoji: "📱",
                title: "WhatsApp Sellers",
                desc: "Already selling via WhatsApp? Upgrade to a professional online store with a WhatsApp store builder that keeps orders organized and automates your catalog.",
                tags: ["WhatsApp orders", "Product catalog", "Order tracking"]
              },
              {
                emoji: "🏪",
                title: "Small Business Owners",
                desc: "Run a local shop or service? Build an ecommerce website for your small business with inventory management, coupons, and analytics — at a fraction of Shopify's price.",
                tags: ["Inventory", "Discounts", "Analytics"]
              },
              {
                emoji: "🚀",
                title: "Entrepreneurs & Startups",
                desc: "Launch your ecommerce startup fast. Our free ecommerce platform lets you test products, validate ideas, and start selling online — before spending a rupee on expensive tools.",
                tags: ["Fast launch", "0% fees", "Scalable"]
              },
              {
                emoji: "🎨",
                title: "Creators & Artists",
                desc: "Sell your digital products, art, or handcrafted items through a beautiful online shop builder. The AI designer makes your store look stunning without any design experience.",
                tags: ["Beautiful design", "Digital products", "AI branding"]
              },
              {
                emoji: "📦",
                title: "Dropshippers",
                desc: "Build a dropshipping website with product listings, stock management, and order automation. Accept payments globally and manage fulfillment from one dashboard.",
                tags: ["Product management", "Payments", "Order automation"]
              }
            ].map((item, i) => (
              <div key={i} className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
                <div className="text-3xl mb-4">{item.emoji}</div>
                <h3 className="font-semibold text-lg text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">{item.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag, j) => (
                    <span key={j} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEO-Rich Content Section */}
      <section className="container mx-auto px-4 lg:px-8 py-24 lg:py-32 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-playfair text-4xl md:text-5xl font-bold text-foreground mb-6">
              Why DigitalDukandar is the Best Free Ecommerce Website Builder
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              Trusted by 10,000+ entrepreneurs worldwide to build ecommerce websites and sell online without coding
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-background p-8 rounded-2xl border border-border/50 shadow-lg">
              <h3 className="font-playfair text-2xl font-bold mb-4 text-foreground">
                🌍 Built for Entrepreneurs Worldwide
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Our <strong>ecommerce website builder</strong> is designed for businesses of all sizes. Accept payments globally, integrate WhatsApp for customer communication, and reach customers everywhere with our <strong>online store builder</strong> — no technical skills required.
              </p>
            </div>

            <div className="bg-background p-8 rounded-2xl border border-border/50 shadow-lg">
              <h3 className="font-playfair text-2xl font-bold mb-4 text-foreground">
                💰 Completely Free to Start
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Start your <strong>free online store</strong> with our 14-day trial — no credit card required. Our <strong>affordable ecommerce platform</strong> plans are the most cost-effective way to <strong>sell online</strong> for small businesses and entrepreneurs worldwide.
              </p>
            </div>

            <div className="bg-background p-8 rounded-2xl border border-border/50 shadow-lg">
              <h3 className="font-playfair text-2xl font-bold mb-4 text-foreground">
                📱 WhatsApp Store Integration
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Convert your business into a <strong>WhatsApp store</strong> instantly. Accept orders directly through WhatsApp — used by over 3 billion people worldwide. Perfect for <strong>small business ecommerce</strong> owners who want to meet customers where they already are.
              </p>
            </div>

            <div className="bg-background p-8 rounded-2xl border border-border/50 shadow-lg">
              <h3 className="font-playfair text-2xl font-bold mb-4 text-foreground">
                ⚡ No Coding Required
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Our <strong>no-code ecommerce website builder</strong> requires zero technical knowledge. Create a professional <strong>online store</strong> in minutes with our AI-powered interface. Perfect for entrepreneurs who want to <strong>build an ecommerce website</strong> without coding.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-10 rounded-2xl border border-primary/20 text-center">
            <h2 className="font-playfair text-3xl font-bold mb-4 text-foreground">
              Start Your Free Ecommerce Website Today
            </h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              Join 10,000+ entrepreneurs using DigitalDukandar as their <strong>ecommerce website builder</strong>. Create your <strong>online store</strong> in just 5 minutes — free, no credit card required.
            </p>
            <Link to="/auth">
              <Button size="lg" className="h-14 px-10 text-base font-semibold shadow-xl">
                <Crown className="w-5 h-5 mr-2" />
                Create Free Online Store Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-primary/5 border-y border-primary/10 py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="font-playfair text-4xl font-bold text-primary mb-1">10,000+</p>
              <p className="text-sm text-muted-foreground">Online Stores Created</p>
            </div>
            <div>
              <p className="font-playfair text-4xl font-bold text-primary mb-1">5 min</p>
              <p className="text-sm text-muted-foreground">Average Setup Time</p>
            </div>
            <div>
              <p className="font-playfair text-4xl font-bold text-primary mb-1">0%</p>
              <p className="text-sm text-muted-foreground">Transaction Fees</p>
            </div>
            <div>
              <p className="font-playfair text-4xl font-bold text-primary mb-1">4.8★</p>
              <p className="text-sm text-muted-foreground">Average Store Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Comparison Section */}
      <section className="container mx-auto px-4 lg:px-8 py-24 lg:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block mb-4">
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">Platform Comparison</span>
            </div>
            <h2 className="font-playfair text-4xl md:text-5xl font-bold text-foreground mb-6">
              The Best Shopify Alternative for Small Business
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              See why thousands of entrepreneurs choose us over Shopify, Wix, and BigCommerce to build their ecommerce website
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/50 shadow-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="text-left p-4 font-semibold">Feature</th>
                  <th className="p-4 font-semibold">DigitalDukandar</th>
                  <th className="p-4 font-semibold text-primary-foreground/70">Shopify</th>
                  <th className="p-4 font-semibold text-primary-foreground/70">Wix</th>
                  <th className="p-4 font-semibold text-primary-foreground/70">BigCommerce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {[
                  ["Free Plan / Trial", "✅ 14-day free trial", "❌ No free plan", "⚠️ Limited free", "❌ No free plan"],
                  ["Transaction Fees", "✅ 0% — zero fees", "❌ Up to 2% per sale", "⚠️ 0% with Wix Pay", "✅ 0% fees"],
                  ["AI Store Designer", "✅ Built-in AI designer", "⚠️ Basic AI tools", "⚠️ Basic AI tools", "❌ No AI designer"],
                  ["WhatsApp Integration", "✅ Native WhatsApp orders", "❌ Third-party only", "❌ Third-party only", "❌ Third-party only"],
                  ["No-Code Setup", "✅ Zero coding needed", "✅ No coding needed", "✅ No coding needed", "⚠️ Some technical setup"],
                  ["Custom Domain", "✅ Free subdomain + custom", "⚠️ Paid add-on", "⚠️ Paid add-on", "✅ Custom domain"],
                  ["Starting Price", "✅ Free to start", "❌ $29/month", "❌ $17/month", "❌ $39/month"],
                  ["Instagram Auto-Reply", "✅ Built-in", "❌ Not available", "❌ Not available", "❌ Not available"],
                ].map(([feature, us, shopify, wix, bc], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="p-4 font-medium text-foreground">{feature}</td>
                    <td className="p-4 text-center font-semibold text-primary">{us}</td>
                    <td className="p-4 text-center text-muted-foreground">{shopify}</td>
                    <td className="p-4 text-center text-muted-foreground">{wix}</td>
                    <td className="p-4 text-center text-muted-foreground">{bc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid md:grid-cols-3 gap-6">
            <div className="bg-background p-6 rounded-2xl border border-border/50 shadow-sm">
              <h3 className="font-semibold text-lg text-foreground mb-2">vs Shopify</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                As a <strong>free Shopify alternative</strong>, we offer zero transaction fees, a built-in AI designer, and native WhatsApp integration — at a fraction of Shopify's $29–$299/month cost.
              </p>
            </div>
            <div className="bg-background p-6 rounded-2xl border border-border/50 shadow-sm">
              <h3 className="font-semibold text-lg text-foreground mb-2">vs Wix</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Unlike Wix, our <strong>ecommerce website builder</strong> is purpose-built for selling online — with inventory management, discount coupons, WhatsApp orders, and advanced analytics included by default.
              </p>
            </div>
            <div className="bg-background p-6 rounded-2xl border border-border/50 shadow-sm">
              <h3 className="font-semibold text-lg text-foreground mb-2">vs WooCommerce</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Unlike WooCommerce, there's no hosting setup, no plugin management, and no coding. As a <strong>no-code ecommerce platform</strong>, you launch your online store in 5 minutes — not 5 days.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 lg:px-8 py-24 lg:py-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-playfair text-4xl md:text-5xl font-bold text-foreground mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to know about building your ecommerce website
            </p>
          </div>
          <div className="space-y-4">
            {[
              {
                q: "What is the best ecommerce website builder?",
                a: "A top-rated free ecommerce website builder that lets you create a professional online store in minutes. Includes AI-powered design, WhatsApp integration, payment processing, and analytics — no coding required."
              },
              {
                q: "Can I create an online store for free?",
                a: "Yes. We offer a free 14-day trial with no credit card required. You get a free subdomain, full ecommerce features, and an AI store designer from day one."
              },
              {
                q: "How do I build an ecommerce website?",
                a: "You can build an ecommerce website in 4 steps: sign up with Google, add your products, customize with the AI designer, then go live and start selling. The whole process takes under 5 minutes."
              },
              {
                q: "What ecommerce platform is best for small business?",
                a: "This platform is built for small businesses. It offers affordable plans, WhatsApp order integration, inventory management, discount coupons, and built-in SEO — everything you need to sell online without technical skills."
              },
              {
                q: "Is this a good Shopify alternative?",
                a: "Yes. This is a powerful Shopify alternative with an AI store designer, WhatsApp integration, custom domain support, and plans at a fraction of Shopify's price. Ideal for entrepreneurs who want to sell online without high fees."
              },
              {
                q: "Does this platform support WhatsApp ecommerce?",
                a: "Yes. Native WhatsApp integration lets customers place orders directly via WhatsApp — making it the best ecommerce platform for businesses that sell through messaging apps."
              },
              {
                q: "How does an AI ecommerce website builder work?",
                a: "The AI designer automatically generates colors, layouts, and themes for your store based on your brand style. You describe what you want, and the AI builds it instantly — no designer or coding needed. Publish your store in minutes."
              },
              {
                q: "Are there ecommerce platforms with no transaction fees?",
                a: "Yes. Unlike Shopify (which charges 0.5–2% per sale), this platform charges zero transaction fees on all plans. You keep 100% of every sale — making it one of the most affordable ecommerce platforms for small businesses."
              },
              {
                q: "What is the best ecommerce platform for beginners?",
                a: "The best ecommerce platform for beginners is one that requires no coding, sets up in minutes, and includes all the tools you need out of the box — payments, inventory, SEO, and analytics. This platform is specifically designed for beginners with a drag-and-drop store builder and AI-powered design."
              },
              {
                q: "Can I start an online store with no money?",
                a: "Yes. You can start a free online store with a 14-day trial — no credit card required. You get a free subdomain, full ecommerce features, WhatsApp integration, and an AI designer at zero cost. Paid plans only begin after your trial."
              },
              {
                q: "What is the cheapest way to build an ecommerce website?",
                a: "The cheapest way to build an ecommerce website is to use a free ecommerce website builder with no transaction fees. Starting free with a 14-day trial and zero transaction fees means you pay nothing until you're ready to scale — far cheaper than Shopify ($29/month + 2% fees) or WooCommerce (hosting + plugins)."
              },
              {
                q: "Which ecommerce platform is better than Shopify for small business?",
                a: "For small businesses, platforms with no transaction fees, a free plan, and built-in tools like WhatsApp integration and an AI designer offer better value than Shopify. Shopify charges $29–$299/month plus up to 2% per transaction — costs that add up fast for small stores."
              },
              {
                q: "Can I sell online without a website?",
                a: "Yes. With WhatsApp ecommerce integration, you can receive and manage orders directly through WhatsApp — no separate website required. You can also share your store link on Instagram, Facebook, or any messaging app to sell online instantly."
              }
            ].map((item, i) => (
              <div key={i} className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold text-lg text-foreground mb-2">{item.q}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 lg:px-8 py-24 lg:py-32">
        <div className="max-w-5xl mx-auto">
          <Card className="relative overflow-hidden border-0 shadow-2xl">
            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/90" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
            
            <div className="relative p-10 lg:p-20 text-center text-primary-foreground">
              <div className="mb-6">
                <TrendingUp className="w-16 h-16 mx-auto text-primary-foreground/90" />
              </div>
              <h2 className="font-playfair text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Ready to Launch Your Store?
              </h2>
              <p className="text-xl md:text-2xl mb-10 opacity-95 max-w-3xl mx-auto leading-relaxed font-light">
                Join thousands of successful entrepreneurs. Create your professional online store today and start selling in minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-5 justify-center items-center mb-8">
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button 
                    size="lg" 
                    variant="secondary"
                    className="w-full sm:w-auto h-14 shadow-2xl hover:shadow-primary-foreground/20 text-base px-10 font-semibold"
                  >
                    <Crown className="w-5 h-5 mr-2" />
                    Start Building Free
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to="/demo" className="w-full sm:w-auto">
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="w-full sm:w-auto h-14 bg-white/10 hover:bg-white/20 border-2 border-white/30 text-white text-base px-10 font-semibold backdrop-blur-sm"
                  >
                    <Globe className="w-5 h-5 mr-2" />
                    View Demo Store
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap justify-center items-center gap-6 text-sm font-medium opacity-90">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>No credit card required</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Free 14-day trial</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 lg:px-8 py-16">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <AppLogo size={32} />
              <span className="font-playfair font-bold text-xl sm:text-2xl bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                DigitalDukandar
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-8 text-sm font-medium text-muted-foreground">
              <Link to="/home" className="hover:text-foreground transition-colors">
                Demo Store
              </Link>
              <a href="#features" className="hover:text-foreground transition-colors">
                Features
              </a>
              <Link to="/pricing" className="hover:text-foreground transition-colors">
                Pricing
              </Link>
              <a href="#how-it-works" className="hover:text-foreground transition-colors">
                How It Works
              </a>
              <a href="#helper-program" className="hover:text-foreground transition-colors">
                For Helpers
              </a>
              <Link to="/guide" className="hover:text-foreground transition-colors">
                Guide
              </Link>
              <Link to="/become-helper" className="hover:text-foreground transition-colors">
                Apply as Helper
              </Link>
              <Link to="/application-status" className="hover:text-foreground transition-colors">
                Check Status
              </Link>
              <Link to="/privacy-policy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms-of-service" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
              <a href="/sitemap.xml" className="hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">
                Sitemap
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 DigitalDukandar. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
