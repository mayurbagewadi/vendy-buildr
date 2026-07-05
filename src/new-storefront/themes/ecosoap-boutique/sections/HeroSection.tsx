import { ArrowRight, Award, Leaf, ShieldAlert, Smile } from "lucide-react";
import StorefrontImage from "@/components/ui/storefront-image";

type HeroCopy = {
  heroBadge: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroImage: string;
  heroFeaturedBadge: string;
  heroFeaturedTitle: string;
  heroSideBadgeTop: string;
  heroSideBadgeBottom: string;
};

type HeroSectionProps = {
  copy: HeroCopy;
  onOpenSoapLab: () => void;
};

const HeroSection = ({ copy, onOpenSoapLab }: HeroSectionProps) => (
  <section className="relative overflow-hidden bg-gradient-to-b from-[#fbfaf6] via-white to-[#f5f1e8] py-16 lg:py-24">
    <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
        <div className="space-y-6 text-left lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-emerald-900">
            <Leaf className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">{copy.heroBadge}</span>
          </div>
          <h1 className="font-serif text-4xl font-medium leading-[1.12] text-stone-900 sm:text-5xl lg:text-6xl">
            {copy.heroTitle} <br />
            <span className="font-normal italic text-emerald-800">{copy.heroHighlight}</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-stone-600 sm:text-lg">
            {copy.heroDescription}
          </p>
          <div className="flex flex-col gap-3 pt-4 sm:flex-row">
            <button
              onClick={() => document.getElementById("ecosoap-products")?.scrollIntoView({ behavior: "smooth" })}
              className="group flex items-center justify-center gap-2 rounded-full bg-stone-900 px-7 py-4 text-sm font-medium tracking-normal text-white shadow-sm transition-all hover:bg-emerald-800"
            >
              {copy.heroPrimaryCta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={onOpenSoapLab}
              className="flex items-center justify-center rounded-full border border-stone-200 px-7 py-4 text-sm font-medium tracking-normal text-stone-800 transition-all hover:border-stone-400 hover:bg-stone-50"
            >
              {copy.heroSecondaryCta}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 border-t border-stone-100 pt-8">
            {[
              [ShieldAlert, "100% Native", "Zero Sulfates or Parabens"],
              [Award, "Eco-Conscious", "Completely Bio-Degradable"],
              [Smile, "Deep Curing", "Gentle Lather Structure"],
            ].map(([Icon, title, text]) => (
              <div key={title as string} className="space-y-1">
                <div className="flex items-center gap-1.5 font-serif text-sm font-semibold text-stone-900">
                  <Icon className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{title as string}</span>
                </div>
                <p className="text-xs text-stone-500">{text as string}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex justify-center lg:col-span-6">
          <div className="relative aspect-[4/3] w-full max-w-lg rotate-1 overflow-hidden rounded-2xl border-4 border-white shadow-2xl transition-transform duration-500 hover:rotate-0">
            <StorefrontImage
              src={copy.heroImage}
              alt="EcoSoap artisanal collection"
              purpose="hero-banner"
              className="h-full w-full object-cover"
              priority
            />
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-emerald-50/85 via-white/20 to-transparent p-6">
              <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-left shadow-sm backdrop-blur-sm">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">{copy.heroFeaturedBadge}</span>
                <h3 className="font-serif text-lg font-medium text-stone-900">{copy.heroFeaturedTitle}</h3>
              </div>
            </div>
          </div>
          <div className="absolute -top-4 -right-2 flex -rotate-3 items-center gap-2 rounded-xl border border-stone-50 bg-white px-4 py-2 shadow-lg transition-transform hover:rotate-0 sm:right-6">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            <p className="text-xs font-semibold text-stone-800">{copy.heroSideBadgeTop}</p>
          </div>
          <div className="absolute -bottom-6 -left-2 rotate-2 rounded-full bg-emerald-500 px-5 py-3 text-white shadow-lg transition-transform hover:rotate-0 sm:left-4">
            <p className="text-xs font-semibold uppercase tracking-wider">{copy.heroSideBadgeBottom}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default HeroSection;
