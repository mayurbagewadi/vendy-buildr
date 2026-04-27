import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Bell, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

const CATEGORIES = ['Feature', 'UI Update', 'Fix', 'Announcement'];

const renderBody = (text: string) =>
  text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-1" />;
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      return (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
          <span className="text-sm text-muted-foreground leading-relaxed">{trimmed.replace(/^[-•]\s/, '')}</span>
        </div>
      );
    }
    return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{trimmed}</p>;
  });

const CATEGORY_COLORS: Record<string, string> = {
  Feature: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'UI Update': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  Fix: 'bg-red-500/10 text-red-600 border-red-500/20',
  Announcement: 'bg-green-500/10 text-green-600 border-green-500/20',
};

const PushNotificationsPage = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('Feature');
  const [active, setActive] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('push_notification_title, push_notification_body, push_notification_category, push_notification_active')
          .eq('id', SETTINGS_ID)
          .single();

        if (error) throw error;
        if (data) {
          setTitle(data.push_notification_title || '');
          setBody(data.push_notification_body || '');
          setCategory(data.push_notification_category || 'Feature');
          setActive(data.push_notification_active || false);
        }
      } catch (err) {
        console.error('Error loading push notification settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Validation Error", description: "Title and message are required.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      // Bump version to a new unique key so all stores see it fresh
      const newVersion = 'notif_v' + Date.now();

      const { error } = await supabase
        .from('platform_settings')
        .update({
          push_notification_title: title.trim(),
          push_notification_body: body.trim(),
          push_notification_category: category,
          push_notification_version: newVersion,
          push_notification_active: true,
          push_notification_sent_at: new Date().toISOString(),
        })
        .eq('id', SETTINGS_ID);

      if (error) throw error;

      setActive(true);
      toast({ title: "Notification Sent", description: "All store owners will see this on next login." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send notification.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (checked: boolean) => {
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({ push_notification_active: checked })
        .eq('id', SETTINGS_ID);

      if (error) throw error;
      setActive(checked);
      toast({ title: checked ? "Notification Activated" : "Notification Deactivated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Push Notifications</h1>
              <p className="text-sm text-muted-foreground">Send what's new updates to all store owners</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Active</span>
              <Switch checked={active} onCheckedChange={handleToggleActive} />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">

          {/* Compose */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Compose Notification
              </CardTitle>
              <CardDescription>
                This will appear as a pop card when store owners open their admin panel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notif-title">Title <span className="text-muted-foreground text-xs">(max 60 chars)</span></Label>
                <Input
                  id="notif-title"
                  placeholder="e.g. New UI updates are here!"
                  maxLength={60}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <p className="text-xs text-muted-foreground text-right">{title.length}/60</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notif-body">Message <span className="text-muted-foreground text-xs">(max 200 chars)</span></Label>
                <Textarea
                  id="notif-body"
                  placeholder="Describe what changed or what's new..."
                  maxLength={200}
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <p className="text-xs text-muted-foreground text-right">{body.length}/200</p>
                <p className="text-xs text-muted-foreground">Tip: Start a line with <code className="bg-muted px-1 rounded">- </code> to make it a bullet point.</p>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={handleSend}
                disabled={isSaving || !title.trim() || !body.trim()}
              >
                <Send className="mr-2 h-4 w-4" />
                {isSaving ? "Sending..." : "Send to All Stores"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Sending bumps the version key — every store owner sees it once on next login.
              </p>
            </CardContent>
          </Card>

          {/* Live Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Live Preview
              </CardTitle>
              <CardDescription>How the pop card will appear to store owners.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border bg-card shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={CATEGORY_COLORS[category] || CATEGORY_COLORS['Feature']}
                  >
                    {category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">What's New</span>
                </div>

                <div>
                  <h3 className="font-semibold text-lg leading-tight">
                    {title || 'Your notification title will appear here'}
                  </h3>
                  <div className="mt-2 space-y-1">
                    {body ? renderBody(body) : <p className="text-sm text-muted-foreground leading-relaxed">Your message body will appear here. Keep it short and clear.</p>}
                  </div>
                </div>

                <Button className="w-full" size="sm">
                  Got it!
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Card slides up with animation. Dismissed permanently after "Got it" click.
              </p>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default PushNotificationsPage;
