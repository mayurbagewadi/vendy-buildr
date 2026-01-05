
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import ConceptNavbar from "@/components/concept/ConceptNavbar";
import { InteractiveParticles } from "@/components/concept/InteractiveParticles";
import MagneticButton from "@/components/concept/MagneticButton";
import TiltCard from "@/components/concept/TiltCard";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
    ArrowRight,
    MapPin,
    HardDrive,
    FileSpreadsheet,
    Search,
    ShieldCheck,
    Sparkles,
    Check,
    Star,
    Play,
    ChevronRight,
    Zap,
    TrendingUp,
    Users,
    Globe
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const ConceptLanding = () => {
    const heroRef = useRef<HTMLDivElement>(null);
    const featuresRef = useRef<HTMLDivElement>(null);
    const statsRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    // Track mouse for gradient effect
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    // GSAP Animations
    useEffect(() => {
        const ctx = gsap.context(() => {
            // Hero entrance animation
            gsap.from(".hero-content > *", {
                y: 100,
                opacity: 0,
                duration: 1.2,
                stagger: 0.15,
                ease: "power4.out",
                delay: 0.3
            });

            // Floating animation for hero badge
            gsap.to(".hero-badge", {
                y: -10,
                duration: 2,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
            });

            // Stats counter animation on scroll
            ScrollTrigger.create({
                trigger: statsRef.current,
                start: "top 80%",
                onEnter: () => {
                    gsap.from(".stat-number", {
                        textContent: 0,
                        duration: 2,
                        snap: { textContent: 1 },
                        stagger: 0.2,
                        ease: "power2.out"
                    });
                }
            });

            // Features stagger reveal
            gsap.from(".feature-card-reveal", {
                scrollTrigger: {
                    trigger: featuresRef.current,
                    start: "top 70%"
                },
                y: 80,
                opacity: 0,
                duration: 0.8,
                stagger: 0.15,
                ease: "power3.out"
            });

        }, heroRef);

        return () => ctx.revert();
    }, []);

    const hardFeatures = [
        {
            icon: MapPin,
            title: "Force GPS Location",
            desc: "No more 'Behind the Temple' addresses. Get exact GPS coordinates from every customer.",
            gradient: "from-rose-500 to-pink-600",
            stat: "99%",
            statLabel: "Delivery Accuracy"
        },
        {
            icon: HardDrive,
            title: "Google Drive Sync",
            desc: "Your phone photos are already in Drive. Pull them directly into products. Zero transfers.",
            gradient: "from-blue-500 to-cyan-500",
            stat: "5min",
            statLabel: "Product Upload"
        },
        {
            icon: Search,
            title: "Google Discovery",
            desc: "WhatsApp catalogs are invisible to Google. Your store ranks for 'Buy X near me' searches.",
            gradient: "from-green-500 to-emerald-500",
            stat: "10x",
            statLabel: "More Reach"
        },
        {
            icon: FileSpreadsheet,
            title: "1-Click Accounting",
            desc: "Download orders as Excel instantly. Your CA will love you. GST-ready reports built in.",
            gradient: "from-violet-500 to-purple-600",
            stat: "₹0",
            statLabel: "Extra CA Fees"
        },
        {
            icon: ShieldCheck,
            title: "Auto-Legal Policies",
            desc: "Privacy, Returns, Shipping policies auto-generated. Look as professional as Amazon.",
            gradient: "from-amber-500 to-orange-500",
            stat: "100%",
            statLabel: "Compliant"
        },
        {
            icon: Globe,
            title: "Your Own Domain",
            desc: "Not wa.me/91xxx. Get yourbrand.com. Build a real brand identity that customers remember.",
            gradient: "from-indigo-500 to-blue-600",
            stat: "∞",
            statLabel: "Brand Value"
        }
    ];

    const stats = [
        { value: "10,000+", label: "Active Stores" },
        { value: "₹50Cr+", label: "GMV Processed" },
        { value: "4.9", label: "Play Store Rating", icon: Star },
        { value: "99.9%", label: "Uptime" }
    ];

    return (
        <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
            <ConceptNavbar />

            {/* Dynamic gradient that follows mouse */}
            <div
                className="fixed inset-0 pointer-events-none z-0 opacity-30 transition-opacity duration-300"
                style={{
                    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(139, 92, 246, 0.15), transparent 40%)`
                }}
            />

            {/* Hero Section */}
            <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-24 pb-16 px-4">
                <InteractiveParticles />

                {/* Gradient orbs */}
                <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/20 rounded-full blur-[120px] animate-pulse delay-1000" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[150px]" />

                <div className="hero-content relative z-10 text-center max-w-6xl mx-auto">
                    {/* Floating Badge */}
                    <div className="hero-badge inline-flex items-center gap-2 bg-gradient-to-r from-primary/20 via-violet-500/20 to-pink-500/20 border border-primary/30 backdrop-blur-xl text-primary px-6 py-3 rounded-full text-sm font-semibold mb-8 shadow-2xl shadow-primary/20">
                        <Sparkles className="w-4 h-4" />
                        <span className="bg-gradient-to-r from-primary via-violet-500 to-pink-500 bg-clip-text text-transparent">
                            Trusted by 10,000+ Indian Entrepreneurs
                        </span>
                        <Sparkles className="w-4 h-4" />
                    </div>

                    {/* Main Headline */}
                    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold font-playfair leading-[1.05] tracking-tight mb-8">
                        <span className="block text-foreground">The Missing Half</span>
                        <span className="block text-foreground">of Your</span>
                        <span className="relative inline-block mt-2">
                            <span className="relative z-10 bg-gradient-to-r from-primary via-violet-500 to-pink-500 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                                Business
                            </span>
                            {/* Underline decoration */}
                            <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                                <path d="M2 10C50 2 100 2 150 6C200 10 250 6 298 2" stroke="url(#underline-gradient)" strokeWidth="4" strokeLinecap="round" />
                                <defs>
                                    <linearGradient id="underline-gradient" x1="0" y1="0" x2="300" y2="0">
                                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                                        <stop offset="50%" stopColor="#8b5cf6" />
                                        <stop offset="100%" stopColor="#ec4899" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-xl md:text-2xl lg:text-3xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-12 font-light">
                        WhatsApp keeps your <span className="text-foreground font-medium">existing</span> customers.
                        <br className="hidden sm:block" />
                        We help you find <span className="text-foreground font-medium">new</span> ones on Google.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-16">
                        <MagneticButton strength={50}>
                            <Link to="/auth?signup=true">
                                <Button size="lg" className="relative group h-16 px-10 text-lg font-semibold rounded-2xl bg-gradient-to-r from-primary via-violet-500 to-pink-500 hover:opacity-90 shadow-2xl shadow-primary/30 transition-all duration-300 hover:shadow-primary/50 hover:scale-105">
                                    <Zap className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                                    Start Free Trial
                                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </MagneticButton>

                        <MagneticButton strength={30}>
                            <Link to="/demo">
                                <Button variant="outline" size="lg" className="h-16 px-10 text-lg font-semibold rounded-2xl border-2 hover:bg-muted/50 backdrop-blur-sm group">
                                    <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                                    Watch Demo
                                </Button>
                            </Link>
                        </MagneticButton>
                    </div>

                    {/* Trust Indicators */}
                    <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-sm">
                        {["No Credit Card", "5-Min Setup", "Cancel Anytime"].map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-muted-foreground">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-r from-primary to-violet-500 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                </div>
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            <section ref={statsRef} className="relative py-16 border-y border-border/50 bg-muted/30 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {stats.map((stat, i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex items-center justify-center gap-2">
                                    <span className="stat-number text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                                        {stat.value}
                                    </span>
                                    {stat.icon && <stat.icon className="w-6 h-6 text-yellow-500 fill-yellow-500" />}
                                </div>
                                <p className="text-muted-foreground text-sm font-medium">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* The WHY Section */}
            <section className="py-24 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />

                <div className="max-w-4xl mx-auto text-center relative z-10 mb-20">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-destructive/10 text-destructive text-sm font-semibold mb-6">
                        The Hard Truth
                    </div>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 font-playfair">
                        WhatsApp Business is{" "}
                        <span className="line-through decoration-destructive/50 decoration-4">Not Enough</span>
                    </h2>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Your WhatsApp catalog is invisible to Google. New customers can't find you. You're missing half the market.
                    </p>
                </div>
            </section>

            {/* Features Grid */}
            <section ref={featuresRef} className="py-16 px-4 relative">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                            Built Different
                        </div>
                        <h2 className="text-4xl md:text-5xl font-bold mb-6 font-playfair">
                            6 Problems. 6 Solutions.
                        </h2>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Real features for real Indian business problems.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {hardFeatures.map((feature, index) => (
                            <TiltCard key={index} className="feature-card-reveal h-full" glareColor="rgba(139, 92, 246, 0.2)">
                                <div className="h-full p-8 rounded-3xl bg-gradient-to-br from-card via-card to-muted/50 border border-border/50 hover:border-primary/50 transition-all duration-500 shadow-xl hover:shadow-2xl hover:shadow-primary/10 relative overflow-hidden group">
                                    {/* Gradient background on hover */}
                                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

                                    {/* Icon */}
                                    <div className={`relative z-10 w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                                        <feature.icon className="w-7 h-7 text-white" />
                                    </div>

                                    {/* Content */}
                                    <h3 className="relative z-10 text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                                        {feature.title}
                                    </h3>
                                    <p className="relative z-10 text-muted-foreground leading-relaxed mb-6">
                                        {feature.desc}
                                    </p>

                                    {/* Stat badge */}
                                    <div className="relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50">
                                        <span className={`text-lg font-bold bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                                            {feature.stat}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{feature.statLabel}</span>
                                    </div>
                                </div>
                            </TiltCard>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-32 px-4 relative overflow-hidden">
                {/* Background effects */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-violet-500/10 to-pink-500/10" />
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[150px]" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[150px]" />

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h2 className="text-4xl md:text-6xl font-bold mb-8 font-playfair">
                        Ready to Get Found on{" "}
                        <span className="bg-gradient-to-r from-primary via-violet-500 to-pink-500 bg-clip-text text-transparent">
                            Google?
                        </span>
                    </h2>
                    <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
                        Join 10,000+ store owners who stopped being invisible. Your first 14 days are on us.
                    </p>

                    <MagneticButton strength={60}>
                        <Link to="/auth?signup=true">
                            <Button size="lg" className="h-20 px-16 text-xl font-bold rounded-3xl bg-gradient-to-r from-primary via-violet-500 to-pink-500 hover:opacity-90 shadow-2xl shadow-primary/40 transition-all duration-300 hover:scale-105 group">
                                <TrendingUp className="w-6 h-6 mr-3 group-hover:animate-bounce" />
                                Start Growing Today
                                <ChevronRight className="w-6 h-6 ml-2 group-hover:translate-x-2 transition-transform" />
                            </Button>
                        </Link>
                    </MagneticButton>

                    <p className="text-sm text-muted-foreground mt-8">
                        No credit card required • Setup in 5 minutes • Cancel anytime
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-4 border-t border-border/50 bg-muted/20">
                <div className="max-w-7xl mx-auto text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-violet-600 flex items-center justify-center">
                            <span className="text-white font-bold text-xl">D</span>
                        </div>
                        <span className="font-playfair font-bold text-2xl">
                            Digital<span className="text-primary">Dukandar</span>
                        </span>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        Made with ❤️ for Indian Entrepreneurs
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default ConceptLanding;
