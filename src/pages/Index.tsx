import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, ArrowRight, Settings } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-2xl mx-auto">
        {/* Hero Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl mb-8 shadow-lg">
          <ShoppingBag className="w-10 h-10 text-primary-foreground" />
        </div>

        {/* Hero Content */}
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          E-Commerce Admin Panel
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-lg mx-auto">
          Professional admin dashboard to manage your online store with powerful product management and analytics.
        </p>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="admin-card cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg mb-4">
                  <Settings className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Admin Panel</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Access your dashboard to manage products, orders, and store settings
                </p>
                <Link to="/admin/login">
                  <Button className="admin-button-primary w-full">
                    Access Admin Panel
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="admin-card cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg mb-4">
                  <ShoppingBag className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Customer Store</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Browse products and shop online
                </p>
                <Link to="/home">
                  <Button className="admin-button-primary w-full">
                    Visit Store
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Demo Credentials */}
        <Card className="admin-card bg-muted/50">
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-3">Demo Access</h3>
            <div className="text-sm text-muted-foreground">
              <p><strong>Username:</strong> admin</p>
              <p><strong>Password:</strong> admin123</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
