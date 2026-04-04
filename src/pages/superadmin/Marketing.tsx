import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Save, Loader2 } from "lucide-react";

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

export default function Marketing() {
  const { toast } = useToast();
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('platform_settings')
      .select('support_whatsapp_number')
      .eq('id', SETTINGS_ID)
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to load settings.", variant: "destructive" });
    } else if (data) {
      setWhatsappNumber(data.support_whatsapp_number || "");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!whatsappNumber.trim()) {
      toast({ title: "Validation Error", description: "Please enter a WhatsApp number.", variant: "destructive" });
      return;
    }

    // Basic validation: only digits and optional leading +
    const cleaned = whatsappNumber.replace(/\s/g, "");
    if (!/^\+?\d{10,15}$/.test(cleaned)) {
      toast({ title: "Invalid Number", description: "Enter a valid number with country code (e.g. 919876543210).", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('platform_settings')
      .update({ support_whatsapp_number: cleaned })
      .eq('id', SETTINGS_ID);

    if (error) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "WhatsApp number updated successfully." });
      setWhatsappNumber(cleaned);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketing</h1>
        <p className="text-muted-foreground mt-1">Configure marketing contact settings for your platform.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            <CardTitle>WhatsApp Support Button</CardTitle>
          </div>
          <CardDescription>
            This number appears on the landing page as a floating WhatsApp button. Visitors who click it will be redirected to WhatsApp with the message <strong>"Need help to setup website"</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp-number">WhatsApp Number (with country code)</Label>
            <Input
              id="whatsapp-number"
              placeholder="e.g. 919876543210"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Include country code without + or spaces. Example: 91 (India) + 9876543210 → <code>919876543210</code>
            </p>
          </div>

          {whatsappNumber && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <span className="font-medium">Preview link: </span>
              <span className="text-muted-foreground break-all">
                https://wa.me/{whatsappNumber.replace(/\D/g, "")}?text=Need+help+to+setup+website
              </span>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Save Number</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
