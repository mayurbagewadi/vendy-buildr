import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Users,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  CreditCard,
  Globe,
  Home,
  BarChart3,
  FileText,
  Package,
  UserCircle,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { supabase } from "@/integrations/supabase/client";

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [adminName, setAdminName] = useState("Super Admin");

  useEffect(() => {
    const initializeAuth = async () => {
      // First check for superadmin session
      const session = sessionStorage.getItem('superadmin_session');
      if (session) {
        const sessionData = JSON.parse(session);
        setAdminName(sessionData.fullName);
        return;
      }

      // If no superadmin session, check Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/superadmin/login');
        return;
      }

      // Check if user has super_admin role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin');

      if (!roles || roles.length === 0) {
        toast({
          title: "Access Denied",
          description: "You need super admin privileges",
          variant: "destructive"
        });
        navigate('/superadmin/login');
        return;
      }

      // Get profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', user.id)
        .single();

      setAdminName(profile?.full_name || profile?.email || user.email || 'Super Admin');
    };

    initializeAuth();
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('superadmin_session');
    localStorage.removeItem('superadmin_remember');
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
    navigate('/superadmin/login');
  };

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/superadmin/dashboard",
      icon: Home,
      current: location.pathname === "/superadmin/dashboard",
    },
    {
      name: "Users & Stores",
      href: "/superadmin/users",
      icon: Users,
      current: location.pathname === "/superadmin/users",
    },
    {
      name: "Helper Management",
      href: "/superadmin/helpers",
      icon: Users,
      current: location.pathname === "/superadmin/helpers",
    },
    {
      name: "Commission Management",
      href: "/superadmin/commissions",
      icon: DollarSign,
      current: location.pathname === "/superadmin/commissions",
    },
    {
      name: "Commission Settings",
      href: "/superadmin/commission-settings",
      icon: Settings,
      current: location.pathname === "/superadmin/commission-settings",
    },
    {
      name: "Reports & Analytics",
      href: "/superadmin/reports-analytics",
      icon: BarChart3,
      current: location.pathname === "/superadmin/reports-analytics",
    },
    {
      name: "Subscription Plans",
      href: "/superadmin/subscription-plans",
      icon: CreditCard,
      current: location.pathname === "/superadmin/subscription-plans",
    },
    {
      name: "Transactions",
      href: "/superadmin/transactions",
      icon: DollarSign,
      current: location.pathname === "/superadmin/transactions",
    },
    {
      name: "Billing & Revenue",
      href: "/superadmin/billing",
      icon: CreditCard,
      current: location.pathname === "/superadmin/billing",
    },
    {
      name: "Custom Domains",
      href: "/superadmin/custom-domains",
      icon: Globe,
      current: location.pathname === "/superadmin/custom-domains",
    },
    {
      name: "SEO & Sitemaps",
      href: "/superadmin/sitemaps",
      icon: FileText,
      current: location.pathname === "/superadmin/sitemaps",
    },
    {
      name: "Marketplace",
      href: "/superadmin/marketplace",
      icon: Package,
      current: location.pathname === "/superadmin/marketplace",
    },
    {
      name: "AI Token Pricing",
      href: "/superadmin/ai-token-pricing",
      icon: Sparkles,
      current: location.pathname === "/superadmin/ai-token-pricing",
    },
    {
      name: "Platform Settings",
      href: "/superadmin/settings",
      icon: Settings,
      current: location.pathname === "/superadmin/settings",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            {/* Menu Button - Visible on all screens */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">YourPlatform - Super Admin</h1>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5" />
                  <span className="hidden md:inline">{adminName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => window.open('/', '_blank')}>
                  <Globe className="mr-2 h-4 w-4" />
                  View Platform Site
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 top-16 z-50 w-64 bg-card border-r min-h-screen p-4
            transform transition-transform duration-300 ease-out shadow-xl
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <nav className="space-y-2">
            {navigationItems.map((item) => (
              <Button
                key={item.name}
                variant={item.current ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  navigate(item.href);
                  if (window.innerWidth < 1024) {
                    setIsSidebarOpen(false);
                  }
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.name}
              </Button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main
          className={`
            flex-1 min-h-screen transition-all duration-300 ease-out
            ${isSidebarOpen ? 'ml-64' : 'ml-0'}
          `}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
