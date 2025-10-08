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
  ArrowUpRight
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    totalCustomers: 0,
  });

  const [storeName, setStoreName] = useState("Your Store");

  useEffect(() => {
    // Load store name from localStorage
    const storeSettings = localStorage.getItem("storeSettings");
    if (storeSettings) {
      const settings = JSON.parse(storeSettings);
      if (settings.storeName) {
        setStoreName(settings.storeName);
      }
    }

    // Demo stats - in real app, fetch from API
    setStats({
      totalProducts: 24,
      activeProducts: 18,
      totalOrders: 156,
      totalCustomers: 89,
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
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome back! 👋</h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with <span className="font-medium text-primary">{storeName}</span> today.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Star className="w-4 h-4 mr-2" />
              Quick Tour
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <Card key={index} className="admin-stat-card group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-2">
                      {stat.value}
                    </p>
                    <p className="flex items-center text-sm text-success mt-1">
                      <ArrowUpRight className="w-3 h-3 mr-1" />
                      {stat.change} from last month
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-transform duration-200`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
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

        {/* Recent Activity Placeholder */}
        <Card className="admin-card">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No recent activity to display</p>
              <p className="text-sm">Start by adding your first product!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;