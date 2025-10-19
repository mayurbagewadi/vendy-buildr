import Header from "@/components/customer/Header";
import Footer from "@/components/customer/Footer";
import PricingSection from "@/components/customer/PricingSection";

const Pricing = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        <PricingSection />
      </main>

      <Footer />
    </div>
  );
};

export default Pricing;
