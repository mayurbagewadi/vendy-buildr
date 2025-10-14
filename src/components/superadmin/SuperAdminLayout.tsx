import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Users,
  CreditCard,
  DollarSign,
  Globe,
  Settings,
  Home,
  LogOut,
  ExternalLink,
  UserCircle,
  Shield,
  Menu,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [adminName, setAdminName] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const session = sessionStorage.getItem('superadmin_session');
    if (!session) {
      navigate('/superadmin/login');
      return;
    }

    const sessionData = JSON.parse(session);
    setAdminName(sessionData.fullName);
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

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/superadmin/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/superadmin/users', icon: Users, label: 'Users & Stores' },
    { path: '/superadmin/plans', icon: CreditCard, label: 'Plans' },
    { path: '/superadmin/transactions', icon: DollarSign, label: 'Transactions' },
    { path: '/superadmin/domains', icon: Globe, label: 'Domains' },
    { path: '/superadmin/settings', icon: Settings, label: 'Settings' },
  ];

  const NavContent = () => (
    <nav className="flex flex-col gap-2">
      {navItems.map((item) => (
        <Button
          key={item.path}
          variant={isActive(item.path) ? "default" : "ghost"}
          className="w-full justify-start"
          onClick={() => {
            navigate(item.path);
            setMobileMenuOpen(false);
          }}
        >
          <item.icon className="mr-2 h-4 w-4" />
          {item.label}
        </Button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <div className="flex items-center gap-2 mb-6">
                  <Shield className="h-6 w-6 text-primary" />
                  <h2 className="text-lg font-bold">Super Admin</h2>
                </div>
                <NavContent />
              </SheetContent>
            </Sheet>
            
            <Shield className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            <h1 className="text-base md:text-xl font-bold">YourPlatform - Super Admin</h1>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                <span className="hidden sm:inline">{adminName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => window.open('/', '_blank')}>
                <ExternalLink className="mr-2 h-4 w-4" />
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
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 border-r bg-card min-h-[calc(100vh-4rem)] p-4">
          <NavContent />
        </aside>

        {/* Main Content */}
        <main className="flex-1 w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
