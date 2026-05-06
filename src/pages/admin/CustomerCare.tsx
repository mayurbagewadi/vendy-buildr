import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SUPPORT_EMAIL = "digtaldukandar.in@gmail.com";
const SETTINGS_ID = "00000000-0000-0000-0000-000000000000";

const CustomerCare = () => {
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNumber = async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("support_whatsapp_number")
        .eq("id", SETTINGS_ID)
        .maybeSingle();

      setWhatsappNumber(data?.support_whatsapp_number || null);
      setLoading(false);
    };

    fetchNumber();
  }, []);

  const handleWhatsApp = () => {
    if (!whatsappNumber) return;
    const cleaned = whatsappNumber.replace(/\D/g, "");
    window.open("https://wa.me/" + cleaned, "_blank");
  };

  const handleEmail = () => {
    window.open("mailto:" + SUPPORT_EMAIL, "_blank");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customer Care</h1>
        <p className="text-muted-foreground mt-1">Reach out to our support team for any help or queries.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* WhatsApp Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="w-5 h-5 text-green-500" />
              WhatsApp Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Chat with us directly on WhatsApp for quick support.
            </p>
            {loading ? (
              <div className="h-9 w-32 bg-muted rounded animate-pulse" />
            ) : whatsappNumber ? (
              <>
                <p className="text-sm font-medium text-foreground">{whatsappNumber}</p>
                <Button onClick={handleWhatsApp} className="bg-green-500 hover:bg-green-600 text-white w-full sm:w-auto">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Chat on WhatsApp
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">WhatsApp support not configured yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Email Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="w-5 h-5 text-primary" />
              Email Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send us an email and we'll get back to you as soon as possible.
            </p>
            <p className="text-sm font-medium text-foreground">{SUPPORT_EMAIL}</p>
            <Button variant="outline" onClick={handleEmail} className="w-full sm:w-auto">
              <Mail className="w-4 h-4 mr-2" />
              Send Email
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerCare;
