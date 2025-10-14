import { Button } from "@/components/ui/button";
import { ShoppingBag, Store, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">StoreBuilder</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 lg:px-6 py-16 lg:py-24">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Launch Your Store in Minutes
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
            Create Your Online Store
            <br />
            <span className="text-primary">Powered by Google Sheets</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            No coding required. Manage products with Google Sheets, accept orders via WhatsApp, and grow your business online.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/auth">
              <Button size="lg" className="w-full sm:w-auto">
                <Store className="w-5 h-5 mr-2" />
                Create Your Store
              </Button>
            </Link>
            <Link to="/home">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                View Demo Store
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 lg:px-6 py-16 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose StoreBuilder?</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Easy Setup</h3>
              <p className="text-muted-foreground text-sm">
                Get your online store up and running in just a few minutes with our simple setup wizard.
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">Google Sheets Integration</h3>
              <p className="text-muted-foreground text-sm">
                Manage your products using the familiar Google Sheets interface. No learning curve!
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">WhatsApp Orders</h3>
              <p className="text-muted-foreground text-sm">
                Customers can place orders directly via WhatsApp with a single click.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 lg:px-6 py-16 lg:py-24">
        <div className="bg-primary text-primary-foreground rounded-2xl p-8 lg:p-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Ready to Launch Your Store?
          </h2>
          <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
            Join thousands of entrepreneurs who are growing their business online. Start your free trial today!
          </p>
          <Link to="/auth">
            <Button size="lg" variant="secondary">
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 lg:px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">StoreBuilder</span>
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
