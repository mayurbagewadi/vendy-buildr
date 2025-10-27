import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Search, Menu, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MiniCart from "@/components/customer/MiniCart";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { generateGeneralInquiryMessage, openWhatsApp } from "@/lib/whatsappUtils";
import { useToast } from "@/hooks/use-toast";

interface HeaderProps {
  storeSlug?: string;
  storeId?: string;
}

const Header = ({ storeSlug, storeId }: HeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Use store-specific routes if storeSlug is provided, otherwise use generic routes
  const homeLink = storeSlug ? `/${storeSlug}` : "/home";
  const productsLink = storeSlug ? `/${storeSlug}/products` : "/products";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`${productsLink}?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
    }
  };

  const handleWhatsApp = async () => {
    const message = generateGeneralInquiryMessage();
    const result = await openWhatsApp(message, undefined, storeId);
    
    if (!result.success) {
      toast({
        title: "WhatsApp Not Configured",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
      {/* Main Header */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to={homeLink} className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg">
              <ShoppingCart className="w-6 h-6 text-primary-foreground transition-transform duration-300 group-hover:rotate-12" />
            </div>
            <span className="text-xl font-bold text-foreground hidden sm:block transition-colors duration-300 group-hover:text-primary">
              MyStore
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to={homeLink} className="relative text-foreground hover:text-primary transition-all duration-300 after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left hover:translate-y-[-2px]">
              Home
            </Link>
            <Link to={productsLink} className="relative text-foreground hover:text-primary transition-all duration-300 after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left hover:translate-y-[-2px]">
              Products
            </Link>
            <Link to={`${homeLink}#categories`} className="relative text-foreground hover:text-primary transition-all duration-300 after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left hover:translate-y-[-2px]">
              Categories
            </Link>
            <Link to={`${homeLink}#about`} className="relative text-foreground hover:text-primary transition-all duration-300 after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left hover:translate-y-[-2px]">
              About
            </Link>
          </nav>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="hidden lg:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="absolute right-0 top-0 group"
              >
                <Search className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
              </Button>
            </div>
          </form>

          {/* Action Buttons - Touch Optimized */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleWhatsApp}
              className="hidden sm:flex min-w-[44px] min-h-[44px] group transition-all duration-300 hover:scale-105"
            >
              <Phone className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" />
            </Button>
            <ThemeToggle />
            <MiniCart />
            
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden min-w-[44px] min-h-[44px] group transition-all duration-300 hover:scale-105"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? 
                <X className="w-5 h-5 animate-in spin-in-180 duration-300" /> : 
                <Menu className="w-5 h-5 animate-in fade-in duration-300" />
              }
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        <form onSubmit={handleSearch} className="lg:hidden mt-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="absolute right-0 top-0 group"
            >
              <Search className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
            </Button>
          </div>
        </form>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background animate-in slide-in-from-top-2 duration-300">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-4">
            <Link
              to={homeLink}
              className="text-foreground hover:text-primary transition-all duration-300 hover:translate-x-2 animate-in fade-in slide-in-from-left-2 duration-300"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to={productsLink}
              className="text-foreground hover:text-primary transition-all duration-300 hover:translate-x-2 animate-in fade-in slide-in-from-left-2 duration-300 delay-75"
              onClick={() => setMobileMenuOpen(false)}
            >
              Products
            </Link>
            <Link
              to={`${homeLink}#categories`}
              className="text-foreground hover:text-primary transition-all duration-300 hover:translate-x-2 animate-in fade-in slide-in-from-left-2 duration-300 delay-150"
              onClick={() => setMobileMenuOpen(false)}
            >
              Categories
            </Link>
            <Link
              to={`${homeLink}#about`}
              className="text-foreground hover:text-primary transition-all duration-300 hover:translate-x-2 animate-in fade-in slide-in-from-left-2 duration-300 delay-200"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <Button onClick={handleWhatsApp} className="w-full min-h-[48px] animate-in fade-in slide-in-from-bottom-2 duration-300 delay-300 group">
              <Phone className="w-5 h-5 mr-2 transition-transform duration-300 group-hover:rotate-12" />
              Contact on WhatsApp
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
