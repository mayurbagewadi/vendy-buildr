
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, ArrowRight } from "lucide-react";

const ConceptNavbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "bg-background/80 backdrop-blur-md border-b shadow-sm py-4" : "bg-transparent py-6"
                }`}
        >
            <div className="container mx-auto px-4 lg:px-8">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <span className="text-white font-bold text-xl">D</span>
                        </div>
                        <span className="font-playfair font-bold text-2xl tracking-tight text-foreground">
                            Digital<span className="text-primary">Dukandar</span>
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                            Features
                        </a>
                        <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                            How it Works
                        </a>
                        <Link to="/pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                            Pricing
                        </Link>
                        <Link to="/become-helper" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                            For Helpers
                        </Link>
                    </nav>

                    {/* Mobile Menu */}
                    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                        <SheetTrigger asChild className="md:hidden">
                            <Button variant="ghost" size="icon">
                                <Menu className="w-6 h-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent>
                            <nav className="flex flex-col gap-4 mt-8">
                                <a
                                    href="#features"
                                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-3 border-b"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Features
                                </a>
                                <a
                                    href="#how-it-works"
                                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-3 border-b"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    How it Works
                                </a>
                                <Link
                                    to="/pricing"
                                    className="text-lg font-medium text-foreground hover:text-primary transition-colors py-3 border-b"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Pricing
                                </Link>
                                <div className="flex flex-col gap-3 mt-6">
                                    <Link to="/auth" className="w-full">
                                        <Button variant="outline" size="lg" className="w-full h-12 min-h-[48px]">
                                            Login
                                        </Button>
                                    </Link>
                                    <Link to="/auth" className="w-full">
                                        <Button size="lg" className="w-full h-12 min-h-[48px]">
                                            Get Started Free
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </Link>
                                </div>
                            </nav>
                        </SheetContent>
                    </Sheet>

                    {/* Desktop Auth Buttons */}
                    <div className="hidden md:flex items-center gap-4">
                        <Link to="/auth">
                            <Button variant="ghost" size="sm" className="font-medium h-11 px-4 text-sm min-h-[44px]">
                                Login
                            </Button>
                        </Link>
                        <Link to="/auth">
                            <Button size="sm" className="shadow-lg hover:shadow-xl transition-all font-medium h-11 px-4 text-sm min-h-[44px]">
                                Get Started Free
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default ConceptNavbar;
