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
  FileSpreadsheet,
  Check
} from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  const features = [
    {
      icon: Zap,
      title: "Lightning Fast Setup",
      description: "Go from zero to live store in under 5 minutes. No technical knowledge required."
    },
    {
      icon: FileSpreadsheet,
      title: "Google Sheets Powered",
      description: "Manage your entire product catalog using familiar spreadsheets."
    },
    {
      icon: Smartphone,
      title: "WhatsApp Integration",
      description: "Customers order directly via WhatsApp - the way they prefer."
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Enterprise-grade security with 99.9% uptime guarantee."
    },
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description: "Track sales, views, and performance with live dashboards."
    },
    {
      icon: Package,
      title: "Unlimited Products",
      description: "Add as many products as you want with variants and images."
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
      title: "Connect Sheets",
      description: "Link your Google Sheets product catalog"
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-lg sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
              <ShoppingBag className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              StoreBuilder
            </span>
          </Link>
          
          <div className="flex items-center gap-3">
            <Link to="/home" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Demo Store
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="hidden sm:flex">
                Sign In
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="shadow-md hover:shadow-lg transition-shadow">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background pointer-events-none" />
        
        <div className="container relative mx-auto px-4 lg:px-8 py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8 shadow-sm animate-in fade-in slide-in-from-bottom-3 duration-700">
              <Sparkles className="w-4 h-4" />
              Trusted by 10,000+ Store Owners
            </div>
            
            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              Build Your Dream Store
              <br />
              <span className="bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
                In Minutes, Not Months
              </span>
            </h1>
            
            {/* Subheading */}
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-5 duration-700 delay-200">
              The easiest way to create and manage your online store. No coding, no complexity - just pure simplicity powered by Google Sheets.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-all group">
                  <Store className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Create Your Store Free
                </Button>
              </Link>
              <Link to="/home" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 hover:bg-muted/50">
                  View Live Demo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center items-center gap-6 mt-12 text-sm text-muted-foreground animate-in fade-in duration-700 delay-500">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Setup in 5 minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 lg:px-8 py-20 lg:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to help you launch, manage, and grow your online business effortlessly.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/20 group"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2 text-foreground">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/30 py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                How It Works
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Get your online store up and running in four simple steps
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((step, index) => (
                <div key={index} className="relative">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-primary/10 border-2 border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-2xl text-primary">
                      {step.number}
                    </div>
                    <h3 className="font-semibold text-xl mb-2 text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {step.description}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent -ml-4" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 lg:px-8 py-20 lg:py-28">
        <div className="max-w-4xl mx-auto">
          <Card className="relative overflow-hidden border-0 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/90" />
            <div className="relative p-8 lg:p-16 text-center text-primary-foreground">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Ready to Launch Your Store?
              </h2>
              <p className="text-lg md:text-xl mb-8 opacity-95 max-w-2xl mx-auto">
                Join thousands of successful entrepreneurs. Create your professional online store today and start selling in minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button 
                    size="lg" 
                    variant="secondary"
                    className="w-full sm:w-auto shadow-lg hover:shadow-xl text-base px-8"
                  >
                    Get Started Free
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to="/home" className="w-full sm:w-auto">
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="w-full sm:w-auto bg-white/10 hover:bg-white/20 border-white/30 text-white text-base px-8"
                  >
                    View Demo Store
                  </Button>
                </Link>
              </div>
              <p className="text-sm mt-6 opacity-90">
                No credit card required • Free 14-day trial • Cancel anytime
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">StoreBuilder</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <Link to="/home" className="hover:text-foreground transition-colors">
                Demo Store
              </Link>
              <span>•</span>
              <a href="#features" className="hover:text-foreground transition-colors">
                Features
              </a>
              <span>•</span>
              <a href="#pricing" className="hover:text-foreground transition-colors">
                Pricing
              </a>
              <span>•</span>
              <a href="#support" className="hover:text-foreground transition-colors">
                Support
              </a>
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
