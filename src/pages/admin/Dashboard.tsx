import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Plus, 
  Eye, 
  TrendingUp, 
  ShoppingCart, 
  Users,
  Star,
  ArrowUpRight,
  Clock
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { toast } from "@/hooks/use-toast";
import { getProducts, initializeProducts } from "@/lib/productData";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    totalCustomers: 0,
  });

  const [storeName, setStoreName] = useState("Your Store");
  const [recentActivity, setRecentActivity] = useState<Array<{
    id: string;
    action: string;
    product: string;
    time: string;
  }>>([]);

  useEffect(() => {
    // Initialize products with seed data if empty
    initializeProducts();
    
    // Load store name from localStorage
    const storeSettings = localStorage.getItem("storeSettings");
    if (storeSettings) {
      const settings = JSON.parse(storeSettings);
      if (settings.storeName) {
        setStoreName(settings.storeName);
      }
    }

    // Load real product data
    const products = getProducts();
    const activeProducts = products.filter(p => p.status === 'published').length;
    
    setStats({
      totalProducts: products.length,
      activeProducts: activeProducts,
      totalOrders: 156, // Demo data
      totalCustomers: 89, // Demo data
    });

    // Demo recent activity
    const demoActivity = [
      {
        id: '1',
        action: 'Product published',
        product: products[0]?.name || 'Sample Product',
        time: '2 hours ago'
      },
      {
        id: '2',
        action: 'New order received',
        product: products[1]?.name || 'Sample Product',
        time: '5 hours ago'
      },
      {
        id: '3',
        action: 'Product updated',
        product: products[2]?.name || 'Sample Product',
        time: '1 day ago'
      }
    ];
    setRecentActivity(demoActivity);

    // Show demo notification
    toast({
      title: "Welcome to your dashboard! 👋",
      description: "All systems are running smoothly.",
    });
  }, []);

  const quickActions = [
    {
      title: "Add New Product",
      description: "Create a new product listing",
      icon: Plus,
      action: () => navigate("/admin/products/add"),
      primary: true,
    },
    {
      title: "View All Products",
      description: "Manage your product catalog",
      icon: Eye,
      action: () => navigate("/admin/products"),
      primary: false,
    },
  ];

  const statCards = [
    {
      title: "Total Products",
      value: stats.totalProducts,
      change: "+12%",
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Active Products",
      value: stats.activeProducts,
      change: "+8%",
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Total Orders",
      value: stats.totalOrders,
      change: "+23%",
      icon: ShoppingCart,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Customers",
      value: stats.totalCustomers,
      change: "+16%",
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-4 lg:space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Welcome back! 👋</h1>
            <p className="text-sm lg:text-base text-muted-foreground mt-1">
              Here's what's happening with <span className="font-medium text-primary">{storeName}</span> today.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="touch-target">
              <Star className="w-4 h-4 mr-2" />
              Quick Tour
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} className="admin-stat-card group">
              <CardContent className="p-4 lg:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs lg:text-sm font-medium text-muted-foreground truncate">
                      {stat.title}
                    </p>
                    <p className="text-xl lg:text-2xl font-bold text-foreground mt-1 lg:mt-2">
                      {stat.value}
                    </p>
                    <p className="flex items-center text-xs lg:text-sm text-success mt-0.5 lg:mt-1">
                      <ArrowUpRight className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{stat.change} from last month</span>
                    </p>
                  </div>
                  <div className={`p-2 lg:p-3 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-transform duration-200 flex-shrink-0 ml-2`}>
                    <stat.icon className={`w-5 h-5 lg:w-6 lg:h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card className="admin-card">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Quick Actions</CardTitle>
            <p className="text-muted-foreground">Get started with these common tasks</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickActions.map((action, index) => (
              <Card key={index} className="admin-card cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20" onClick={action.action}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${action.primary ? 'bg-primary/10' : 'bg-muted'}`}>
                      <action.icon className={`w-6 h-6 ${action.primary ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">
                        {action.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {action.description}
                      </p>
                      <Button 
                        variant={action.primary ? "default" : "outline"} 
                        size="sm"
                        className={action.primary ? "admin-button-primary" : "admin-button-secondary"}
                        onClick={(e) => {
                          e.stopPropagation();
                          action.action();
                        }}
                      >
                        Get Started
                        <ArrowUpRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="admin-card">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Recent Activity</CardTitle>
            <p className="text-muted-foreground">Latest updates from your store</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{activity.action}</p>
                    <p className="text-sm text-muted-foreground">{activity.product}</p>
                    <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No recent activity to display</p>
                <p className="text-sm">Start by adding your first product!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;