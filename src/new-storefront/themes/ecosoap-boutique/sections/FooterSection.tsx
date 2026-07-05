import { Leaf } from "lucide-react";

type FooterStore = {
  name: string;
};

type FooterCopy = {
  footerDescription: string;
  footerMenuTitle: string;
  footerAssurancesTitle: string;
  footerPrivacyLabel: string;
  footerSustainabilityLabel: string;
};

type FooterSectionProps = {
  store: FooterStore;
  copy: FooterCopy;
  onSelectTab: (tab: string) => void;
};

const FooterSection = ({ store, copy, onSelectTab }: FooterSectionProps) => (
  <footer className="border-t border-stone-100 bg-white py-12 text-stone-600 md:py-16">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 text-left md:grid-cols-4">
        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-emerald-50 p-1.5 text-emerald-700">
              <Leaf className="h-5 w-5" />
            </div>
            <span className="font-serif text-xl font-bold text-stone-900">{store.name || "EcoSoap"}</span>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-stone-500 sm:text-sm">
            {copy.footerDescription}
          </p>
        </div>
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">{copy.footerMenuTitle}</h4>
          <ul className="space-y-1.5 text-xs font-medium text-stone-500">
            <li><button onClick={() => onSelectTab("shop")} className="hover:text-emerald-700">Artisanal Shop</button></li>
            <li><button onClick={() => onSelectTab("soap-lab")} className="hover:text-emerald-700">Experimental Soap Lab</button></li>
            <li><button onClick={() => onSelectTab("skin-guide")} className="hover:text-emerald-700">AI Botanical Assessment</button></li>
            <li><button onClick={() => onSelectTab("sustainability")} className="hover:text-emerald-700">Footprint Trackers</button></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">{copy.footerAssurancesTitle}</h4>
          <ul className="space-y-1.5 text-xs text-stone-500">
            {["100% Vegan & Cruelty-Free", "Rainforest Alliance Palm Oil", "Sustainably Sourced Wood Trays"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-10 flex flex-col justify-between border-t border-stone-100 pt-8 text-left text-xs text-stone-400 sm:flex-row">
        <p>(c) {new Date().getFullYear()} {store.name || "EcoSoap Studio"}. All Rights Reserved.</p>
        <div className="mt-2 flex gap-4 sm:mt-0">
          <a href="#" className="hover:text-stone-600">{copy.footerPrivacyLabel}</a>
          <a href="#" className="hover:text-stone-600">{copy.footerSustainabilityLabel}</a>
        </div>
      </div>
    </div>
  </footer>
);

export default FooterSection;
