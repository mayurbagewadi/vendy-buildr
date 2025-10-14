import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Copy, ExternalLink, Plus, Eye, BookOpen, Download, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const Complete = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [storeData, setStoreData] = useState<any>(null);
  const [daysLeft, setDaysLeft] = useState(14);

  useEffect(() => {
    loadStoreData();
  }, []);

  const loadStoreData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("stores")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) setStoreData(data);
    }
  };

  const copyStoreUrl = () => {
    const url = `${storeData?.slug}.yourplatform.com`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied!",
      description: "Store URL copied to clipboard"
    });
  };

  const handleComplete = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Mark onboarding as complete
      await supabase
        .from("profiles")
        .update({ /* onboarding_completed: true */ })
        .eq("user_id", user.id);

      toast({
        title: "🎉 Welcome aboard!",
        description: "Your store is ready to go."
      });

      navigate("/admin/dashboard");
    } catch (error) {
      console.error(error);
    }
  };

  const trialProgress = ((14 - daysLeft) / 14) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/5 to-primary/5">
      {/* Progress Bar - Complete */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
        <div className="h-full bg-primary w-full transition-all duration-300" />
      </div>

      {/* Confetti Effect */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-1/4 animate-bounce">
          <Sparkles className="w-6 h-6 text-yellow-500" />
        </div>
        <div className="absolute top-32 right-1/4 animate-bounce delay-100">
          <Sparkles className="w-4 h-4 text-blue-500" />
        </div>
        <div className="absolute top-40 left-1/3 animate-bounce delay-200">
          <Sparkles className="w-5 h-5 text-purple-500" />
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-12 md:py-16">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 mb-6 animate-pulse">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">🎉 Your Store is Ready!</h1>
          <p className="text-lg text-muted-foreground">You're all set to start selling</p>
        </div>

        {/* Store Summary Card */}
        <Card className="p-6 md:p-8 mb-8 shadow-lg">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">{storeData?.name || "Your Store"}</h2>
              <div className="flex items-center justify-center gap-2 text-primary font-medium">
                <span>{storeData?.slug}.yourplatform.com</span>
                <Button variant="ghost" size="sm" onClick={copyStoreUrl} className="h-8 w-8 p-0">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => window.open(`https://${storeData?.slug}.yourplatform.com`, "_blank")}>
                <ExternalLink className="w-4 h-4" />
                Visit Store
              </Button>
              <Button variant="outline">
                <Download className="w-4 h-4" />
                Download QR Code
              </Button>
            </div>

            {/* QR Code Placeholder */}
            <div className="flex justify-center">
              <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                <span className="text-xs text-muted-foreground">QR Code</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Trial Information */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Your free trial ends in {daysLeft} days</h3>
              <Button variant="outline" size="sm">
                View Plans
              </Button>
            </div>
            <Progress value={trialProgress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              Trial ends on {new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </p>
          </div>
        </Card>

        {/* Quick Start Guide */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-center">Quick Start Guide</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {/* Card 1 */}
            <Card className="p-6 text-center space-y-4 hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10">
                <Plus className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold mb-2">Add Your First Product</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Add products to your store
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/admin/products/add")}
              >
                Add Product
              </Button>
            </Card>

            {/* Card 2 */}
            <Card className="p-6 text-center space-y-4 hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10">
                <Eye className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold mb-2">View Your Store</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  See how customers see your store
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(`https://${storeData?.slug}.yourplatform.com`, "_blank")}
              >
                Open Store
              </Button>
            </Card>

            {/* Card 3 */}
            <Card className="p-6 text-center space-y-4 hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/10">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold mb-2">Learn More</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Watch tutorials and guides
                </p>
              </div>
              <Button variant="outline" className="w-full">
                View Resources
              </Button>
            </Card>
          </div>
        </div>

        {/* What's Next Checklist */}
        <Card className="p-6 mb-8">
          <h3 className="font-semibold mb-4">What's Next</h3>
          <div className="space-y-3">
            {[
              "Add your first product",
              "Customize store policies",
              "Share your store link",
              "Receive your first order"
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded border-2 border-muted-foreground" />
                <span className="text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Button size="lg" onClick={handleComplete} className="w-full sm:w-auto px-8">
            Go to Dashboard
          </Button>
          <Button variant="ghost" size="lg" onClick={handleComplete} className="w-full sm:w-auto">
            I'll explore on my own
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Complete;
