import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Instagram, Check, X, Plus, Trash2, MessageCircle, AtSign } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";

interface AutoReplyRule {
  id: string;
  keywords: string[];
  reply: string;
}

interface AutoReplySettings {
  enabled: boolean;
  default_message: string;
  rules: AutoReplyRule[];
}

interface CommentAutoReplySettings {
  enabled: boolean;
  default_reply: string;
}

const GrowthInstagram = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  // Instagram connection state
  const [isConnected, setIsConnected] = useState(false);
  const [instagramUsername, setInstagramUsername] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null);

  // Auto-reply settings
  const [autoReplySettings, setAutoReplySettings] = useState<AutoReplySettings>({
    enabled: false,
    default_message: "Thanks for your message! We'll get back to you soon.",
    rules: [],
  });

  // Comment auto-reply settings
  const [commentSettings, setCommentSettings] = useState<CommentAutoReplySettings>({
    enabled: false,
    default_reply: "Thanks for your comment!",
  });

  // New rule form
  const [newKeywords, setNewKeywords] = useState("");
  const [newReply, setNewReply] = useState("");

  useEffect(() => {
    // Check for OAuth callback status
    const status = searchParams.get("status");
    const message = searchParams.get("message");

    if (status === "success") {
      toast.success(message || "Instagram connected successfully!");
      // Clear URL params
      navigate("/admin/growth/instagram", { replace: true });
    } else if (status === "error") {
      toast.error(message || "Failed to connect Instagram");
      navigate("/admin/growth/instagram", { replace: true });
    }

    loadSettings();
  }, [searchParams]);

  const loadSettings = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: store, error } = await supabase
        .from("stores")
        .select("id, instagram_connected, instagram_username, instagram_token_expiry, auto_reply_settings, comment_auto_reply_settings")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error loading store:", error);
        toast.error("Failed to load settings");
        return;
      }

      setStoreId(store.id);
      setIsConnected(store.instagram_connected || false);
      setInstagramUsername(store.instagram_username);
      setTokenExpiry(store.instagram_token_expiry);

      if (store.auto_reply_settings) {
        setAutoReplySettings(store.auto_reply_settings as AutoReplySettings);
      }

      if (store.comment_auto_reply_settings) {
        setCommentSettings(store.comment_auto_reply_settings as CommentAutoReplySettings);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectInstagram = () => {
    if (!storeId) {
      toast.error("Store not found");
      return;
    }

    // Redirect to Instagram OAuth
    const oauthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-oauth?action=connect&store_id=${storeId}`;
    window.location.href = oauthUrl;
  };

  const handleDisconnectInstagram = async () => {
    if (!storeId) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-oauth?action=disconnect&store_id=${storeId}`
      );

      if (response.ok) {
        setIsConnected(false);
        setInstagramUsername(null);
        setTokenExpiry(null);
        toast.success("Instagram disconnected");
      } else {
        toast.error("Failed to disconnect");
      }
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Failed to disconnect Instagram");
    }
  };

  const handleSaveSettings = async () => {
    if (!storeId) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("stores")
        .update({
          auto_reply_settings: autoReplySettings,
          comment_auto_reply_settings: commentSettings,
        })
        .eq("id", storeId);

      if (error) throw error;

      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addRule = () => {
    if (!newKeywords.trim() || !newReply.trim()) {
      toast.error("Please enter keywords and reply message");
      return;
    }

    const keywords = newKeywords.split(",").map(k => k.trim()).filter(k => k);

    const newRule: AutoReplyRule = {
      id: Date.now().toString(),
      keywords,
      reply: newReply.trim(),
    };

    setAutoReplySettings(prev => ({
      ...prev,
      rules: [...prev.rules, newRule],
    }));

    setNewKeywords("");
    setNewReply("");
    toast.success("Rule added");
  };

  const removeRule = (ruleId: string) => {
    setAutoReplySettings(prev => ({
      ...prev,
      rules: prev.rules.filter(r => r.id !== ruleId),
    }));
  };

  const isTokenExpiringSoon = () => {
    if (!tokenExpiry) return false;
    const expiryDate = new Date(tokenExpiry);
    const daysUntilExpiry = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry < 7;
  };

  const handleRefreshToken = async () => {
    if (!storeId) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-oauth?action=refresh&store_id=${storeId}`
      );

      const data = await response.json();

      if (data.success) {
        setTokenExpiry(data.expires_at);
        toast.success("Token refreshed successfully!");
      } else {
        toast.error(data.error || "Failed to refresh token");
      }
    } catch (error) {
      console.error("Error refreshing token:", error);
      toast.error("Failed to refresh token");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Instagram Settings</h1>
          <p className="text-muted-foreground mt-1">
            Connect your Instagram Business account and configure auto-replies
          </p>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5" />
              Instagram Connection
            </CardTitle>
            <CardDescription>
              Connect your Instagram Business account to enable auto-replies
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <Check className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium text-green-800 dark:text-green-200">Connected</p>
                    {instagramUsername && (
                      <p className="text-sm text-green-600 dark:text-green-400">@{instagramUsername}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDisconnectInstagram}>
                    Disconnect
                  </Button>
                </div>

                {/* Token Expiry Warning */}
                {tokenExpiry && (
                  <div className={`p-3 rounded-lg ${isTokenExpiringSoon() ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200' : 'bg-muted'}`}>
                    <p className="text-sm">
                      Token expires: {new Date(tokenExpiry).toLocaleDateString()}
                      {isTokenExpiringSoon() && (
                        <span className="text-yellow-600 ml-2">(Expiring soon!)</span>
                      )}
                    </p>
                    <Button variant="link" size="sm" className="p-0 h-auto" onClick={handleRefreshToken}>
                      Refresh Token
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <X className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">Not Connected</p>
                    <p className="text-sm text-muted-foreground">Connect your Instagram to enable features</p>
                  </div>
                </div>
                <Button onClick={handleConnectInstagram} className="w-full sm:w-auto">
                  <Instagram className="w-4 h-4 mr-2" />
                  Connect Instagram
                </Button>
                <p className="text-xs text-muted-foreground">
                  You'll need an Instagram Business or Creator account connected to a Facebook Page.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auto-Reply Settings - Only show if connected */}
        {isConnected && (
          <>
            {/* DM Auto-Reply */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  DM Auto-Reply
                </CardTitle>
                <CardDescription>
                  Automatically reply to direct messages
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Auto-Reply</Label>
                    <p className="text-sm text-muted-foreground">Automatically respond to incoming DMs</p>
                  </div>
                  <Switch
                    checked={autoReplySettings.enabled}
                    onCheckedChange={(checked) =>
                      setAutoReplySettings(prev => ({ ...prev, enabled: checked }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Default Reply Message</Label>
                  <Textarea
                    value={autoReplySettings.default_message}
                    onChange={(e) =>
                      setAutoReplySettings(prev => ({ ...prev, default_message: e.target.value }))
                    }
                    placeholder="Thanks for your message! We'll get back to you soon."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    This message is sent when no keyword rules match
                  </p>
                </div>

                {/* Keyword Rules */}
                <div className="space-y-4">
                  <Label>Keyword Rules</Label>
                  <p className="text-sm text-muted-foreground">
                    Set specific replies for messages containing certain keywords
                  </p>

                  {/* Existing Rules */}
                  {autoReplySettings.rules.length > 0 && (
                    <div className="space-y-2">
                      {autoReplySettings.rules.map((rule) => (
                        <div key={rule.id} className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              Keywords: {rule.keywords.join(", ")}
                            </p>
                            <p className="text-sm text-muted-foreground">{rule.reply}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRule(rule.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Rule */}
                  <div className="p-4 border border-dashed rounded-lg space-y-3">
                    <Input
                      value={newKeywords}
                      onChange={(e) => setNewKeywords(e.target.value)}
                      placeholder="Keywords (comma separated): price, cost, how much"
                    />
                    <Textarea
                      value={newReply}
                      onChange={(e) => setNewReply(e.target.value)}
                      placeholder="Reply message for these keywords..."
                      rows={2}
                    />
                    <Button variant="outline" size="sm" onClick={addRule}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Rule
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comment Auto-Reply */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AtSign className="w-5 h-5" />
                  Comment Auto-Reply
                </CardTitle>
                <CardDescription>
                  Automatically reply to comments on your posts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Comment Auto-Reply</Label>
                    <p className="text-sm text-muted-foreground">Automatically respond to new comments</p>
                  </div>
                  <Switch
                    checked={commentSettings.enabled}
                    onCheckedChange={(checked) =>
                      setCommentSettings(prev => ({ ...prev, enabled: checked }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Default Comment Reply</Label>
                  <Textarea
                    value={commentSettings.default_reply}
                    onChange={(e) =>
                      setCommentSettings(prev => ({ ...prev, default_reply: e.target.value }))
                    }
                    placeholder="Thanks for your comment!"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default GrowthInstagram;
