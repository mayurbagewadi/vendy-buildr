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
  ShoppingCart,
  CreditCard,
  AlertTriangle,
  XCircle,
  Rocket,
  Search,
  ChevronDown,
  Share2,
  Instagram,
  Store,
  Truck,
  Star
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AppLogo } from "@/components/ui/AppLogo";
import { useNotifications } from "@/hooks/useNotifications";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [storeName, setStoreName] = useState("Your Store");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [openDropdowns, setOpenDropdowns] = useState<string[]>([]); // All dropdowns collapsed by default
  const [limitWarning, setLimitWarning] = useState<{
    whatsapp: boolean;
    website: boolean;
    whatsappUsed: number;
    whatsappLimit: number;
    websiteUsed: number;
    websiteLimit: number;
  } | null>(null);
  const [showWarning, setShowWarning] = useState(true);
  const [expirationWarning, setExpirationWarning] = useState<{
    expired: boolean;
    expiresAt: string;
  } | null>(null);
  const [showExpirationWarning, setShowExpirationWarning] = useState(true);
  const [showStoreDeletedDialog, setShowStoreDeletedDialog] = useState(false);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);

  // Dynamic notifications from existing database tables (orders, products)
  const { notifications, unreadCount } = useNotifications();

  useEffect(() => {
    const checkAuth = async () => {
      console.log('[AdminLayout] Checking authentication...');

      // Check Supabase authentication
      const { data: { session } } = await supabase.auth.getSession();

      console.log('[AdminLayout] Session:', session ? 'Found' : 'None');

      if (!session) {
        console.log('[AdminLayout] No session - redirecting to auth');
        navigate("/auth", { replace: true });
        return;
      }

      console.log('[AdminLayout] User authenticated:', session.user.email);

      // Set user email
      if (session.user.email) {
        setUserEmail(session.user.email);
      }

      // Get user profile for full name
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', session.user.id)
        .maybeSingle();

      // If profile doesn't exist, create it (handles cases where trigger didn't fire)
      if (!profile) {
        console.log('[AdminLayout] Profile not found - creating profile for user');

        const { data: newProfile, error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            user_id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || ''
          })
          .select('full_name, email')
          .single();

        if (createProfileError) {
          console.error('[AdminLayout] Error creating profile:', createProfileError);
        } else {
          console.log('[AdminLayout] Profile created successfully');
          profile = newProfile;
        }
      }

      if (profile?.full_name) {
        setUserName(profile.full_name);
      }

      // Load store data - store owners are automatically admins of their own store
      const { data: store, error } = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      console.log('[AdminLayout] Store data:', store ? 'Found' : 'None', error ? `Error: ${error.message}` : '');

      // Check if store doesn't exist (new user needs onboarding or store was deleted)
      if (!store) {
        console.log('[AdminLayout] No store found - showing store deleted dialog');
        setShowStoreDeletedDialog(true);
        // Set a timer to redirect after showing the dialog
        const redirectTimer = setTimeout(() => {
          navigate("/onboarding/store-setup", { replace: true });
        }, 3000);
        return () => clearTimeout(redirectTimer);
      }

      if (store.name) {
        console.log('[AdminLayout] Setting store name:', store.name);
        setStoreName(store.name);
      }

      // Set enabled features
      if (store.enabled_features) {
        setEnabledFeatures(store.enabled_features as string[]);
      }

      // Check subscription limits and expiration
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select(`
          *,
          subscription_plans (
            whatsapp_orders_limit,
            website_orders_limit
          )
        `)
        .eq("user_id", session.user.id)
        .single();

      if (subscription) {
        // Check if subscription has expired
        const now = new Date();
        const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
        
        if (periodEnd && periodEnd < now) {
          setExpirationWarning({
            expired: true,
            expiresAt: periodEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          });
        }

        // Check order limits
        if (subscription?.subscription_plans) {
          const whatsappLimit = subscription.subscription_plans.whatsapp_orders_limit;
          const websiteLimit = subscription.subscription_plans.website_orders_limit;
          const whatsappUsed = subscription.whatsapp_orders_used || 0;
          const websiteUsed = subscription.website_orders_used || 0;

          // Check if limits are reached (100%) or close to limit (90%+)
          const whatsappAtLimit = whatsappLimit && whatsappLimit > 0 && whatsappUsed >= whatsappLimit;
          const websiteAtLimit = websiteLimit && websiteLimit > 0 && websiteUsed >= websiteLimit;

          if (whatsappAtLimit || websiteAtLimit) {
            setLimitWarning({
              whatsapp: whatsappAtLimit,
              website: websiteAtLimit,
              whatsappUsed,
              whatsappLimit: whatsappLimit || 0,
              websiteUsed,
              websiteLimit: websiteLimit || 0,
            });
          }
        }
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
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

  const handleLogout = async () => {
    console.log('[AdminLayout] Logging out...');
    
    await supabase.auth.signOut();
    
    console.log('[AdminLayout] User signed out');
    
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out",
    });
    navigate("/");
  };

  const toggleDropdown = (name: string) => {
    setOpenDropdowns(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
      current: location.pathname === "/admin/dashboard",
    },
    {
      name: "Categories",
      href: "/admin/categories",
      icon: Package,
      current: location.pathname === "/admin/categories",
    },
    {
      name: "Products",
      href: "/admin/products",
      icon: Package,
      current: location.pathname.startsWith("/admin/products"),
    },
    {
      name: "Orders",
      href: "/admin/orders",
      icon: ShoppingCart,
      current: location.pathname === "/admin/orders",
    },
    {
      name: "Analytics",
      href: "/admin/analytics",
      icon: LayoutDashboard,
      current: location.pathname === "/admin/analytics",
    },
    {
      name: "Growth",
      icon: Rocket,
      isDropdown: true,
      current: location.pathname.startsWith("/admin/growth"),
      subItems: [
        {
          name: "SEO",
          href: "/admin/growth/seo",
          icon: Search,
          current: location.pathname === "/admin/growth/seo",
        },
        {
          name: "Social Media",
          href: "/admin/growth/social-media",
          icon: Share2,
          current: location.pathname === "/admin/growth/social-media",
        },
        {
          name: "Instagram",
          href: "/admin/growth/instagram",
          icon: Instagram,
          current: location.pathname === "/admin/growth/instagram",
        },
      ],
    },
    {
      name: "Subscription",
      href: "/admin/subscription",
      icon: CreditCard,
      current: location.pathname === "/admin/subscription",
    },
    // Conditionally show Shipping when enabled
    ...(enabledFeatures.includes('shipping') ? [{
      name: "Shipping",
      href: "/admin/shipping",
      icon: Truck,
      current: location.pathname === "/admin/shipping",
    }] : []),
    // Conditionally show Google Reviews when enabled
    ...(enabledFeatures.includes('google-reviews') ? [{
      name: "Google Reviews",
      href: "/admin/google-reviews",
      icon: Star,
      current: location.pathname === "/admin/google-reviews",
    }] : []),
    {
      name: "Marketplace",
      href: "/admin/marketplace",
      icon: Store,
      current: location.pathname === "/admin/marketplace",
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
              <AppLogo size={24} />
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
            <div key={item.name}>
              {item.isDropdown ? (
                // Dropdown Menu Item
                <div>
                  <button
                    onClick={() => toggleDropdown(item.name)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 touch-target
                      ${item.current
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium text-sm">{item.name}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        openDropdowns.includes(item.name) ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {/* Sub Items */}
                  <div
                    className={`overflow-hidden transition-all duration-200 ${
                      openDropdowns.includes(item.name)
                        ? 'max-h-96 opacity-100'
                        : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="pl-4 mt-1 space-y-1">
                      {item.subItems?.map((subItem) => (
                        <Link
                          key={subItem.name}
                          to={subItem.href}
                          onClick={() => {
                            if (window.innerWidth < 1024) {
                              setIsSidebarOpen(false);
                            }
                          }}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 touch-target
                            ${subItem.current
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }
                          `}
                        >
                          <subItem.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium text-sm">{subItem.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                // Regular Menu Item
                <Link
                  to={item.href!}
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
              )}
            </div>
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
              <AppLogo size={20} />
              <span className="font-semibold text-foreground text-sm truncate max-w-[120px]">{storeName}</span>
            </div>

            {/* Right Header Actions */}
            <div className="flex items-center gap-2 lg:gap-3 ml-auto">
              <ThemeToggle />
              {/* Notifications */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="relative p-2 hover:bg-muted rounded-lg transition-colors touch-target"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5 text-foreground" />
                  {unreadCount > 0 && (
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
                        You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="max-h-80 overflow-y-auto scrollbar-hide">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                          <p className="text-sm text-muted-foreground">No notifications yet</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            You'll see new orders and stock alerts here
                          </p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
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
                        ))
                      )}
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
                  <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
                    {userName || userEmail || "Admin User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {userName && userEmail ? userEmail : "Store Manager"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Expiration Warning Banner */}
        {expirationWarning && showExpirationWarning && (
          <div className="px-4 lg:px-6 pt-4 lg:pt-6">
            <div className="max-w-7xl mx-auto">
              <Alert className="border-destructive bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <AlertDescription className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-destructive mb-1">
                      Subscription Expired
                    </p>
                    <p className="text-sm text-foreground">
                      Your subscription expired on {expirationWarning.expiresAt}. You cannot accept new orders until you renew your subscription.{" "}
                      <Button
                        variant="link"
                        className="h-auto p-0 text-primary hover:text-primary/80 font-semibold"
                        onClick={() => navigate("/admin/subscription")}
                      >
                        Renew your subscription
                      </Button>
                      {" "}to continue accepting orders.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 h-6 w-6 hover:bg-destructive/20"
                    onClick={() => setShowExpirationWarning(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          </div>
        )}

        {/* Limit Warning Banner */}
        {limitWarning && showWarning && !expirationWarning && (
          <div className="px-4 lg:px-6 pt-4 lg:pt-6">
            <div className="max-w-7xl mx-auto">
              <Alert className="border-destructive bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <AlertDescription className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-destructive mb-1">
                      Order Limit Reached
                    </p>
                    <p className="text-sm text-foreground">
                      {limitWarning.whatsapp && limitWarning.website && (
                        <>You've reached your WhatsApp ({limitWarning.whatsappUsed}/{limitWarning.whatsappLimit}) and Website ({limitWarning.websiteUsed}/{limitWarning.websiteLimit}) order limits. </>
                      )}
                      {limitWarning.whatsapp && !limitWarning.website && (
                        <>You've reached your WhatsApp order limit ({limitWarning.whatsappUsed}/{limitWarning.whatsappLimit}). </>
                      )}
                      {!limitWarning.whatsapp && limitWarning.website && (
                        <>You've reached your Website order limit ({limitWarning.websiteUsed}/{limitWarning.websiteLimit}). </>
                      )}
                      <Button
                        variant="link"
                        className="h-auto p-0 text-primary hover:text-primary/80 font-semibold"
                        onClick={() => navigate("/admin/subscription")}
                      >
                        Upgrade your plan
                      </Button>
                      {" "}to continue receiving orders.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 h-6 w-6 hover:bg-destructive/20"
                    onClick={() => setShowWarning(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          </div>
        )}

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

    {/* Store Deleted Dialog */}
    <Dialog open={showStoreDeletedDialog} onOpenChange={setShowStoreDeletedDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-red-100 p-3">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl font-bold">
            Store Deleted
          </DialogTitle>
          <DialogDescription className="text-center pt-4">
            Your store has been deleted by an administrator. You will now be redirected to the store setup page where you can create a new store.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => {
              setShowStoreDeletedDialog(false);
              navigate("/onboarding/store-setup", { replace: true });
            }}
            className="w-full sm:w-auto"
          >
            Create New Store
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminLayout;