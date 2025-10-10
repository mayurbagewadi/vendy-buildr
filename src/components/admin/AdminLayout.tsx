import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Package, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ShoppingBag,
  Bell,
  User,
  FileSpreadsheet
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [storeName, setStoreName] = useState("Your Store");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const notifications = [
    {
      id: 1,
      title: "New Order Received",
      description: "Order #1234 has been placed",
      time: "5 minutes ago",
      unread: true
    },
    {
      id: 2,
      title: "Product Stock Low",
      description: "Premium Coffee is running low",
      time: "2 hours ago",
      unread: true
    },
    {
      id: 3,
      title: "New Customer",
      description: "John Doe has registered",
      time: "1 day ago",
      unread: false
    }
  ];

  useEffect(() => {
    // Check authentication
    const adminToken = localStorage.getItem("adminToken");
    
    if (!adminToken) {
      navigate("/admin/login");
      return;
    }

    // Load store name
    const storeSettings = localStorage.getItem("storeSettings");
    if (storeSettings) {
      const settings = JSON.parse(storeSettings);
      if (settings.storeName) {
        setStoreName(settings.storeName);
      }
    }
  }, [navigate]);

  useEffect(() => {
    // Close notification dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out",
    });
    navigate("/admin/login");
  };

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
      current: location.pathname === "/admin/dashboard",
    },
    {
      name: "Products",
      href: "/admin/products",
      icon: Package,
      current: location.pathname.startsWith("/admin/products"),
    },
    {
      name: "Google Sheets",
      href: "/admin/google-sheets",
      icon: FileSpreadsheet,
      current: location.pathname === "/admin/google-sheets",
    },
    {
      name: "Settings",
      href: "/admin/settings",
      icon: Settings,
      current: location.pathname === "/admin/settings",
    },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col
          transform transition-transform duration-300 ease-out shadow-xl lg:shadow-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-foreground text-sm truncate">{storeName}</h2>
                <p className="text-xs text-muted-foreground truncate">Admin Panel</p>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-1.5 hover:bg-muted rounded-md transition-colors touch-target"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
          {navigationItems.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setIsSidebarOpen(false);
                }
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 touch-target
                ${item.current 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-foreground hover:bg-muted'
                }
              `}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          ))}
        </nav>

        {/* Sign Out Button */}
        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 transition-all duration-200 touch-target"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14 lg:h-16">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors touch-target"
              aria-label="Toggle menu"
            >
              <Menu className="w-6 h-6 text-foreground" />
            </button>

            {/* Logo for mobile when sidebar is closed */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground text-sm truncate max-w-[120px]">{storeName}</span>
            </div>

            {/* Right Header Actions */}
            <div className="flex items-center gap-2 lg:gap-3 ml-auto">
              {/* Notifications */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="relative p-2 hover:bg-muted rounded-lg transition-colors touch-target"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5 text-foreground" />
                  {notifications.filter(n => n.unread).length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-card"></span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {isNotificationOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-top-2"
                  >
                    <div className="p-4 border-b border-border">
                      <h3 className="font-semibold text-foreground text-sm">Notifications</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        You have {notifications.filter(n => n.unread).length} unread notifications
                      </p>
                    </div>
                    <div className="max-h-80 overflow-y-auto scrollbar-hide">
                      {notifications.map((notification) => (
                        <div 
                          key={notification.id}
                          className={`p-4 hover:bg-muted transition-colors cursor-pointer border-b border-border last:border-0 ${
                            notification.unread ? 'bg-primary/5' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-sm font-medium text-foreground flex-1">{notification.title}</p>
                            {notification.unread && (
                              <span className="w-2 h-2 bg-primary rounded-full mt-1 ml-2 flex-shrink-0"></span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{notification.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile */}
              <div className="flex items-center gap-2 pl-2 lg:pl-3 border-l border-border">
                <div className="w-8 h-8 lg:w-9 lg:h-9 bg-primary rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 lg:w-5 lg:h-5 text-primary-foreground" />
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-foreground truncate max-w-[120px]">Admin User</p>
                  <p className="text-xs text-muted-foreground truncate">Store Manager</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto smooth-scroll">
          <div className="p-4 lg:p-6">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;