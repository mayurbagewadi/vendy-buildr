import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Share2,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  Loader2,
  Save,
  Info,
  ExternalLink,
  CheckCircle2
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SocialMediaSettings {
  facebook_url: string;
  instagram_url: string;
  twitter_url: string;
  youtube_url: string;
  linkedin_url: string;
}

const SocialMediaPage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeId, setStoreId] = useState<string | null>(null);

  const [settings, setSettings] = useState<SocialMediaSettings>({
    facebook_url: "",
    instagram_url: "",
    twitter_url: "",
    youtube_url: "",
    linkedin_url: "",
  });

  useEffect(() => {
    loadStoreData();
  }, []);

  /**
   * Enterprise Pattern: Auto-fill with Fallback Chain
   * Priority: Growth-specific field → Settings field → Default
   */
  const loadStoreData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: store, error } = await supabase
        .from("stores")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (error || !store) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load store data",
        });
        return;
      }

      setStoreId(store.id);
      setStoreName(store.name || "");

      // Extract social links from store (entered in Settings page)
      const socialLinks = store.social_links as {
        facebook?: string | null;
        instagram?: string | null;
        twitter?: string | null;
      } | null;

      /**
       * Auto-fill Logic:
       * 1. First check if Growth-specific field has value (already saved)
       * 2. If empty, fall back to Settings social_links
       */
      setSettings({
        facebook_url: store.facebook_url || socialLinks?.facebook || "",
        instagram_url: store.instagram_url || socialLinks?.instagram || "",
        twitter_url: store.twitter_url || socialLinks?.twitter || "",
        youtube_url: store.youtube_url || "",
        linkedin_url: store.linkedin_url || "",
      });
    } catch (error) {
      console.error("Error loading store data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!storeId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({
          facebook_url: settings.facebook_url || null,
          instagram_url: settings.instagram_url || null,
          twitter_url: settings.twitter_url || null,
          youtube_url: settings.youtube_url || null,
          linkedin_url: settings.linkedin_url || null,
        })
        .eq("id", storeId);

      if (error) throw error;

      toast({
        title: "Social Media Settings Saved",
        description: "Your social media links have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save social media settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const validateUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const getUrlStatus = (url: string) => {
    if (!url) return null;
    return validateUrl(url) ? "valid" : "invalid";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const socialPlatforms = [
    {
      key: "facebook_url",
      name: "Facebook",
      icon: Facebook,
      placeholder: "https://facebook.com/yourstore",
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      key: "instagram_url",
      name: "Instagram",
      icon: Instagram,
      placeholder: "https://instagram.com/yourstore",
      color: "text-pink-600",
      bgColor: "bg-pink-100 dark:bg-pink-900/30",
    },
    {
      key: "twitter_url",
      name: "Twitter / X",
      icon: Twitter,
      placeholder: "https://twitter.com/yourstore",
      color: "text-sky-500",
      bgColor: "bg-sky-100 dark:bg-sky-900/30",
    },
    {
      key: "youtube_url",
      name: "YouTube",
      icon: Youtube,
      placeholder: "https://youtube.com/@yourstore",
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900/30",
    },
    {
      key: "linkedin_url",
      name: "LinkedIn",
      icon: Linkedin,
      placeholder: "https://linkedin.com/company/yourstore",
      color: "text-blue-700",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
  ];

  const connectedCount = Object.values(settings).filter(url => url && validateUrl(url)).length;

  return (
    <TooltipProvider>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Share2 className="w-6 h-6" />
                Social Media
              </h1>
              <p className="text-muted-foreground mt-1">
                Connect your social profiles to increase visibility
              </p>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>

          {/* Stats Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-center justify-between pt-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Why Social Media Matters</p>
                  <p className="text-muted-foreground mt-1">
                    Social links appear in Google search results and help customers find and trust your store.
                    Connected profiles also improve your SEO ranking.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{connectedCount}</div>
                <div className="text-xs text-muted-foreground">Connected</div>
              </div>
            </CardContent>
          </Card>

          {/* Social Media Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Social Media Profiles
              </CardTitle>
              <CardDescription>
                Add your social media profile URLs. These will appear on your store and in search results.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {socialPlatforms.map((platform) => {
                const value = settings[platform.key as keyof SocialMediaSettings];
                const status = getUrlStatus(value);

                return (
                  <div key={platform.key} className="space-y-2">
                    <Label htmlFor={platform.key} className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${platform.bgColor}`}>
                        <platform.icon className={`w-4 h-4 ${platform.color}`} />
                      </div>
                      {platform.name}
                      {status === "valid" && (
                        <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={platform.key}
                        placeholder={platform.placeholder}
                        value={value}
                        onChange={(e) => setSettings(prev => ({ ...prev, [platform.key]: e.target.value }))}
                        className={status === "invalid" ? "border-red-500" : ""}
                      />
                      {value && validateUrl(value) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => window.open(value, '_blank')}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Open in new tab</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {status === "invalid" && (
                      <p className="text-xs text-red-500">Please enter a valid URL</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Preview Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Preview
              </CardTitle>
              <CardDescription>
                How your social links will appear on your store footer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-6">
                <p className="text-sm text-muted-foreground mb-4">Follow {storeName} on social media:</p>
                <div className="flex flex-wrap gap-3">
                  {socialPlatforms.map((platform) => {
                    const value = settings[platform.key as keyof SocialMediaSettings];
                    const isConnected = value && validateUrl(value);

                    return (
                      <div
                        key={platform.key}
                        className={`p-3 rounded-lg transition-all ${
                          isConnected
                            ? `${platform.bgColor} cursor-pointer hover:scale-105`
                            : 'bg-muted/50 opacity-50'
                        }`}
                      >
                        <platform.icon className={`w-5 h-5 ${isConnected ? platform.color : 'text-muted-foreground'}`} />
                      </div>
                    );
                  })}
                </div>
                {connectedCount === 0 && (
                  <p className="text-sm text-muted-foreground mt-4 italic">
                    No social profiles connected yet. Add URLs above to display them here.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Save Button (bottom) */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} size="lg">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Social Media Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </TooltipProvider>
  );
};

export default SocialMediaPage;
