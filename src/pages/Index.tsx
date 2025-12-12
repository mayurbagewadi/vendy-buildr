import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  Target
} from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const Index = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const features = [
    {
      icon: Zap,
      title: "Lightning Fast Setup",
      description: "Launch your premium store in under 5 minutes. No technical expertise needed.",
      gradient: "from-amber-500 to-orange-500"
    },
    {
      icon: Package,
      title: "Smart Inventory",
      description: "Manage your product catalog efficiently with our intuitive interface.",
      gradient: "from-emerald-500 to-teal-500"
    },
    {
      icon: Smartphone,
      title: "WhatsApp Integration",
      description: "Connect with customers on their preferred messaging platform.",
      gradient: "from-green-500 to-emerald-600"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-level security with 99.9% uptime guarantee for peace of mind.",
      gradient: "from-blue-500 to-indigo-500"
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Make data-driven decisions with real-time insights and reports.",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: Crown,
      title: "Premium Experience",
      description: "Deliver a luxurious shopping experience that converts visitors to customers.",
      gradient: "from-yellow-500 to-amber-500"
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

  // SEO Schema for Organization
  const organizationSchema = {
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
    "description": "Create your online store in minutes. Launch a professional e-commerce website with custom subdomain, WhatsApp integration, and powerful analytics. No coding required.",
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
      {/* SEO Meta Tags */}
      <Helmet>
        {/* Primary Meta Tags */}
        <title>DigitalDukandar - Create Your Online Store in Minutes | Free E-commerce Platform India</title>
        <meta name="title" content="DigitalDukandar - Create Your Online Store in Minutes | Free E-commerce Platform India" />
        <meta name="description" content="Launch your professional online store in 5 minutes. Get free subdomain, WhatsApp integration, inventory management & analytics. No coding needed. Trusted by 10,000+ Indian entrepreneurs. Start free trial!" />
        <meta name="keywords" content="online store builder India, create online store, e-commerce platform India, free online store, sell online India, WhatsApp store, digital store maker, small business e-commerce, Indian online shopping platform, store builder no coding" />
        <link rel="canonical" href="https://digitaldukandar.in" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://digitaldukandar.in" />
        <meta property="og:title" content="DigitalDukandar - Create Your Online Store in Minutes" />
        <meta property="og:description" content="Launch your professional online store in 5 minutes. No coding required. Trusted by 10,000+ entrepreneurs." />
        <meta property="og:image" content="https://digitaldukandar.in/logo.png" />
        <meta property="og:site_name" content="DigitalDukandar" />
        <meta property="og:locale" content="en_IN" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://digitaldukandar.in" />
        <meta name="twitter:title" content="DigitalDukandar - Create Your Online Store in Minutes" />
        <meta name="twitter:description" content="Launch your professional online store in 5 minutes. No coding required. Trusted by 10,000+ entrepreneurs." />
        <meta name="twitter:image" content="https://digitaldukandar.in/logo.png" />

        {/* Additional SEO */}
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="geo.region" content="IN" />
        <meta name="geo.placename" content="India" />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(organizationSchema)}
        </script>
      </Helmet>

      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-3 sm:gap-4 group flex-shrink-0" aria-label="DigitalDukandar Home">
            <img
              src="/logo.png"
              alt="DigitalDukandar Logo"
              className="h-12 sm:h-14 md:h-16 w-auto object-contain transition-transform group-hover:scale-105"
            />
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
            <Link to="/demo" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Demo Store
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
                    to="/demo"
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-3 border-b"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Demo Store
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
      <section className="relative overflow-hidden bg-gradient-to-b from-background via-primary/[0.02] to-background">
        {/* Decorative Elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20" />
        
        <div className="container relative mx-auto px-4 lg:px-8 py-24 lg:py-36">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 text-primary px-5 py-2.5 rounded-full text-sm font-semibold mb-8 shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-3 duration-700">
              <Star className="w-4 h-4 fill-primary" />
              Trusted by 10,000+ Entrepreneurs Worldwide
              <Sparkles className="w-4 h-4" />
            </div>
            
            {/* Main Heading */}
            <h1 className="font-playfair text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-foreground mb-6 leading-[1.1] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              Free Online Store India
              <br />
              <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent inline-block mt-2">
                Launch in 5 Minutes
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed font-light animate-in fade-in slide-in-from-bottom-5 duration-700 delay-200">
              Create your professional online store builder for small business India. Sell online with WhatsApp integration, custom domain, and powerful inventory management. No coding required - start your free e-commerce platform today!
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-5 justify-center items-center animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 mb-12">
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
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm font-medium animate-in fade-in duration-700 delay-500">
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
      <section id="features" className="container mx-auto px-4 lg:px-8 py-24 lg:py-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-block mb-4">
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">Premium Features</span>
            </div>
            <h2 className="font-playfair text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Everything You Need to Succeed
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Powerful features designed to help you launch, manage, and grow your online business with elegance and ease.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="relative p-8 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border-0 bg-gradient-to-br from-card to-card/50 backdrop-blur group overflow-hidden"
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                
                <div className="relative z-10">
                  <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-playfair font-bold text-xl mb-3 text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative bg-gradient-to-b from-muted/30 via-muted/20 to-background py-24 lg:py-32">
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
                <div key={index} className="relative">
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

      {/* SEO-Rich Content Section */}
      <section className="container mx-auto px-4 lg:px-8 py-24 lg:py-32 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-playfair text-4xl md:text-5xl font-bold text-foreground mb-6">
              Why DigitalDukandar is the Best Free Online Store Builder in India
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              Trusted by over 10,000+ small businesses across India to sell online and grow their digital presence
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-background p-8 rounded-2xl border border-border/50 shadow-lg">
              <h3 className="font-playfair text-2xl font-bold mb-4 text-foreground">
                🇮🇳 Built for Indian Entrepreneurs
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Our <strong>e-commerce platform India</strong> is designed specifically for local businesses. Accept payments in INR, integrate WhatsApp for customer communication, and reach customers across India with our <strong>online store builder</strong> made for the Indian market.
              </p>
            </div>

            <div className="bg-background p-8 rounded-2xl border border-border/50 shadow-lg">
              <h3 className="font-playfair text-2xl font-bold mb-4 text-foreground">
                💰 Completely Free to Start
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Start your <strong>free online store</strong> with our 14-day trial - no credit card required. Our <strong>affordable pricing plans</strong> start from just ₹299/month, making it the most cost-effective way to <strong>sell online India</strong> for small businesses.
              </p>
            </div>

            <div className="bg-background p-8 rounded-2xl border border-border/50 shadow-lg">
              <h3 className="font-playfair text-2xl font-bold mb-4 text-foreground">
                📱 WhatsApp Store Integration
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Convert your business into a <strong>WhatsApp store</strong> instantly. Accept orders directly through WhatsApp - India's most popular messaging app. Perfect for <strong>small business e-commerce</strong> owners who want to meet customers where they are.
              </p>
            </div>

            <div className="bg-background p-8 rounded-2xl border border-border/50 shadow-lg">
              <h3 className="font-playfair text-2xl font-bold mb-4 text-foreground">
                ⚡ No Coding Required
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Our <strong>digital store maker</strong> requires zero technical knowledge. Create a professional <strong>online shopping website</strong> in minutes with our easy drag-and-drop interface. Perfect for <strong>store builder no coding</strong> solutions in India.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-10 rounded-2xl border border-primary/20 text-center">
            <h3 className="font-playfair text-3xl font-bold mb-4 text-foreground">
              Start Your Free Online Store in India Today
            </h3>
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              Join 10,000+ successful Indian entrepreneurs using DigitalDukandar as their <strong>e-commerce platform India</strong>. Create your <strong>online store builder for small business India</strong> in just 5 minutes.
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
              <img
                src="/logo.png"
                alt="DigitalDukandar Logo"
                className="h-10 sm:h-12 w-auto object-contain"
              />
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
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 StoreBuilder. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
