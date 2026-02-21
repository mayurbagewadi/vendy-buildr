import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Star, CheckCircle2, Loader2, ExternalLink, Power, RefreshCw, AlertCircle, User } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Review {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  profile_photo_url: string;
  relative_time_description: string;
}

interface ReviewsCache {
  id: string;
  average_rating: number;
  total_reviews: number;
  reviews: Review[];
  last_fetched: string;
}

const AdminGoogleReviews = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [placeId, setPlaceId] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [displayType, setDisplayType] = useState<"carousel" | "column" | "google-widget">("carousel");
  const [reviewsCache, setReviewsCache] = useState<ReviewsCache | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [quota, setQuota] = useState<{
    used: number;
    limit: number;
    remaining: number;
    period: string;
  } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: store } = await supabase
        .from('stores')
        .select('id, google_place_id, google_reviews_enabled, google_reviews_display_type, google_maps_url')
        .eq('user_id', session.user.id)
        .single();

      if (store) {
        setStoreId(store.id);
        setEnabled(store.google_reviews_enabled || false);
        setPlaceId(store.google_place_id || "");
        setGoogleMapsUrl(store.google_maps_url || "");
        setDisplayType((store.google_reviews_display_type || "carousel") as "carousel" | "column" | "google-widget");

        // Check if user has purchased Google Reviews from marketplace
        const { data: purchase } = await supabase
          .from('marketplace_purchases')
          .select('*')
          .eq('store_id', store.id)
          .eq('feature_slug', 'google-reviews')
          .eq('status', 'active')
          .single();

        if (purchase) {
          const callsLimit = purchase.quota_limit || 15;
          const callsUsed = purchase.calls_used || 0;
          setQuota({
            used: callsUsed,
            limit: callsLimit,
            remaining: callsLimit - callsUsed,
            period: 'monthly'
          });

          // Load cached reviews if place_id exists
          if (store.google_place_id) {
            loadCachedReviews(store.id);
          }
        } else {
          // Not purchased - show message
          toast({
            title: "Google Reviews Not Purchased",
            description: "Please purchase Google Reviews from the Marketplace to use this feature.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCachedReviews = async (store_id: string) => {
    try {
      const { data, error } = await supabase
        .from('google_reviews_cache')
        .select('*')
        .eq('store_id', store_id)
        .single();

      if (data && !error) {
        setReviewsCache(data as any);
      }
    } catch (error) {
      console.error('Error loading cached reviews:', error);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({ google_reviews_enabled: checked })
        .eq('id', storeId);

      if (error) throw error;

      setEnabled(checked);
      toast({
        title: checked ? "Google Reviews Enabled" : "Google Reviews Disabled",
        description: checked
          ? "Reviews will display on your store"
          : "Reviews are hidden from your store",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update setting",
        variant: "destructive",
      });
    } finally {
      setToggling(false);
    }
  };

  const handleSavePlaceId = async () => {
    if (!placeId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Google Place ID",
        variant: "destructive",
      });
      return;
    }

    setFetching(true);
    try {
      // Save Place ID to store
      const { error: updateError } = await supabase
        .from('stores')
        .update({ google_place_id: placeId.trim() })
        .eq('id', storeId);

      if (updateError) throw updateError;

      // Fetch reviews from Google API
      const { data, error } = await supabase.functions.invoke('google-reviews', {
        body: { store_id: storeId, google_place_id: placeId.trim() }
      });

      if (error) throw error;

      if (data.success) {
        setReviewsCache(data.data);
        // Update quota
        if (data.quota) {
          setQuota(data.quota);
        }
        toast({
          title: "Success",
          description: `Reviews fetched successfully. ${data.quota?.remaining || 0} calls remaining this ${data.quota?.period || 'period'}.`,
        });
      } else {
        throw new Error(data.error || "Failed to fetch reviews");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch reviews",
        variant: "destructive",
      });
    } finally {
      setFetching(false);
    }
  };

  const handleRefreshReviews = async () => {
    if (!placeId) {
      toast({
        title: "Error",
        description: "Please save a Place ID first",
        variant: "destructive",
      });
      return;
    }

    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-reviews', {
        body: { store_id: storeId, google_place_id: placeId }
      });

      if (error) throw error;

      if (data.success) {
        setReviewsCache(data.data);
        // Update quota
        if (data.quota) {
          setQuota(data.quota);
        }
        toast({
          title: "Success",
          description: `Reviews refreshed successfully. ${data.quota?.remaining || 0} calls remaining this ${data.quota?.period || 'period'}.`,
        });
      } else {
        throw new Error(data.error || "Failed to refresh reviews");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh reviews",
        variant: "destructive",
      });
    } finally {
      setFetching(false);
    }
  };

  const handleSaveDisplayType = async (type: "carousel" | "column" | "google-widget") => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({ google_reviews_display_type: type })
        .eq('id', storeId);

      if (error) throw error;

      setDisplayType(type);
      const displayNames: Record<string, string> = {
        'carousel': 'Carousel (Auto-scroll)',
        'column': 'Column (Side-by-side)',
        'google-widget': 'Google Widget (All Reviews)'
      };
      toast({
        title: "Success",
        description: `Display type changed to ${displayNames[type]}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save display type",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGoogleMapsUrl = async () => {
    console.log('Saving Google Maps URL:', googleMapsUrl);
    console.log('Store ID:', storeId);

    if (!googleMapsUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Google Maps URL",
        variant: "destructive",
      });
      return;
    }

    if (!storeId) {
      toast({
        title: "Error",
        description: "Store ID not found. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error, data } = await supabase
        .from('stores')
        .update({ google_maps_url: googleMapsUrl.trim() })
        .eq('id', storeId)
        .select();

      console.log('Update result:', { error, data });

      if (error) throw error;

      toast({
        title: "Success ✓",
        description: "Google Maps URL saved successfully! Your store will now show reviews.",
      });
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save URL",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'
            }`}
          />
        ))}
      </div>
    );
  };

  const getInitials = (name: string) => {
    const words = name.trim().split(' ');
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-blue-400 to-blue-600',
      'from-green-400 to-green-600',
      'from-purple-400 to-purple-600',
      'from-pink-400 to-pink-600',
      'from-orange-400 to-orange-600',
      'from-teal-400 to-teal-600',
      'from-indigo-400 to-indigo-600',
      'from-red-400 to-red-600',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="h-6 w-6" />
              Google Reviews
            </h1>
            <p className="text-muted-foreground">
              Display Google reviews on your store to build trust
            </p>
          </div>
          {reviewsCache && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {reviewsCache.total_reviews} Reviews
            </Badge>
          )}
        </div>

        {/* Enable/Disable Toggle */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${enabled ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-muted'}`}>
                  <Power className={`h-6 w-6 ${enabled ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <h3 className="font-semibold">Google Reviews Display</h3>
                  <p className="text-sm text-muted-foreground">
                    {enabled
                      ? "Reviews are visible on your store"
                      : "Reviews are hidden from your store"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${enabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
                <Switch
                  checked={enabled}
                  onCheckedChange={handleToggle}
                  disabled={toggling}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Display Type Selector */}
        {enabled && (
          <Card>
            <CardHeader>
              <CardTitle>Display Type</CardTitle>
              <CardDescription>
                Choose how reviews are displayed on your store
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="display-type">Review Display Style</Label>
                <Select value={displayType} onValueChange={(value) => handleSaveDisplayType(value as "carousel" | "column" | "google-widget")}>
                  <SelectTrigger id="display-type" disabled={saving}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="carousel">
                      <div className="flex flex-col">
                        <span className="font-medium">Carousel (Auto-scroll)</span>
                        <span className="text-xs text-muted-foreground">Smooth left-sliding auto-scroll with 5 reviews</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="column">
                      <div className="flex flex-col">
                        <span className="font-medium">Column (Side-by-side)</span>
                        <span className="text-xs text-muted-foreground">Grid layout with 5 reviews max</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="google-widget">
                      <div className="flex flex-col">
                        <span className="font-medium">Google Widget (All Reviews)</span>
                        <span className="text-xs text-muted-foreground">Links to all reviews on Google Maps</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Display Type Description */}
              <div className="p-4 bg-muted/50 rounded-lg border">
                <h4 className="font-semibold text-sm mb-2">
                  {displayType === 'carousel' ? '🎠 Carousel Mode' : displayType === 'column' ? '📊 Column Mode' : '🔗 Google Widget'}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {displayType === 'carousel'
                    ? 'Reviews will smoothly auto-scroll left, displaying 5 cards at a time. Mobile visitors can swipe to see more reviews.'
                    : displayType === 'column'
                    ? 'Reviews will be displayed in a responsive grid layout. Desktop shows 3 columns, tablet shows 2 columns, mobile shows 1 column.'
                    : 'Displays a button linking to your Google Business Profile showing all reviews. Shows complete review count and authentic ratings.'}
                </p>
              </div>

              {/* Google Maps URL Field (for google-widget) */}
              {displayType === 'google-widget' && (
                <div className="space-y-3 pt-4 border-t">
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                    <AlertCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      <strong>Google Widget Mode:</strong> No Place ID or API needed! Just paste your Google Maps link below.
                      Your store will display reviews from the cache (if available) or show a link to Google.
                    </AlertDescription>
                  </Alert>

                  <Label htmlFor="google_maps_url">Google Maps URL</Label>
                  <Input
                    id="google_maps_url"
                    type="url"
                    placeholder="https://maps.app.goo.gl/xxxxx or full Google Maps URL"
                    value={googleMapsUrl}
                    onChange={(e) => setGoogleMapsUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste the Google Maps link from your business profile (e.g., https://maps.app.goo.gl/1FiEnfPeVMheDDdz5)
                  </p>
                  <Button
                    onClick={handleSaveGoogleMapsUrl}
                    disabled={saving}
                    className="w-full md:w-auto"
                  >
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {saving ? 'Saving...' : 'Save Google Maps URL'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quota Display */}
        {quota && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${quota.remaining > 0 ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                    <RefreshCw className={`h-6 w-6 ${quota.remaining > 0 ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">API Calls Quota</h3>
                    <p className="text-sm text-muted-foreground">
                      {quota.used} of {quota.limit} calls used this {quota.period === 'monthly' ? 'month' : 'year'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {quota.remaining}/{quota.limit}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Remaining
                  </p>
                </div>
              </div>
              {quota.remaining === 0 && (
                <Alert className="mt-4 border-red-200 bg-red-50 dark:bg-red-900/20">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-600">
                    You've reached your API call limit. Upgrade your plan or wait for the next {quota.period === 'monthly' ? 'month' : 'year'} to refresh reviews.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Setup Card */}
        <Card>
          <CardHeader>
            <CardTitle>Google Place ID {displayType === 'google-widget' && <span className="text-sm font-normal text-muted-foreground">(Optional for Widget mode)</span>}</CardTitle>
            <CardDescription>
              {displayType === 'google-widget'
                ? 'Optional: Fetch reviews to display them on your store. Or skip this and just use the Google Maps URL below.'
                : 'Enter your Google Place ID to fetch reviews from Google'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>How to find your Place ID:</strong>
                <div className="mt-3 space-y-3">
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <h4 className="font-semibold text-sm mb-2">Google Place ID Finder (Easiest Method)</h4>
                    <p className="text-xs mb-2">
                      <strong>Official Google Tool:</strong>{' '}
                      <a
                        href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium"
                      >
                        Place ID Finder (CLICK HERE)
                      </a>
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Open the link above</li>
                      <li>Type your business name in the search box</li>
                      <li>Click on your business marker on the map</li>
                      <li>The Place ID appears in the info box (starts with "ChIJ...")</li>
                      <li>Copy it!</li>
                    </ol>
                    <p className="text-xs text-muted-foreground mt-2">
                      <strong>Example:</strong> ChIJN1t_tDeuEmsRUsoyG83frY4
                    </p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Google API Limitation:</strong> Google Places API returns a maximum of 5 reviews,
                sorted by relevance (not date). New reviews may take time to appear as Google rotates
                which reviews it considers "most helpful". This is a Google limitation, not our system.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 max-w-md">
              <Label htmlFor="place_id">Google Place ID</Label>
              <Input
                id="place_id"
                type="text"
                placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Example: ChIJN1t_tDeuEmsRUsoyG83frY4
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSavePlaceId} disabled={fetching || (quota?.remaining === 0)}>
                {fetching && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {reviewsCache ? 'Update Place ID' : 'Save & Fetch Reviews'}
              </Button>
              {reviewsCache && (
                <Button variant="outline" onClick={handleRefreshReviews} disabled={fetching || (quota?.remaining === 0)}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${fetching ? 'animate-spin' : ''}`} />
                  Refresh Reviews
                </Button>
              )}
            </div>
            {quota?.remaining === 0 && (
              <p className="text-sm text-red-600 dark:text-red-400">
                API quota exceeded. Cannot fetch reviews until next {quota.period === 'monthly' ? 'month' : 'year'}.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Reviews Preview */}
        {reviewsCache && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Reviews Preview</span>
                <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                  Last updated: {new Date(reviewsCache.last_fetched).toLocaleDateString()}
                </div>
              </CardTitle>
              <CardDescription>
                Showing {reviewsCache.reviews?.length || 0} of {reviewsCache.total_reviews} total reviews
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Rating Summary */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold">{reviewsCache.average_rating}</div>
                  {renderStars(reviewsCache.average_rating)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Based on {reviewsCache.total_reviews} Google reviews
                </div>
              </div>

              {/* Reviews List */}
              <div className="space-y-3">
                {reviewsCache.reviews?.slice(0, 5).map((review, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-start gap-3">
                      {review.profile_photo_url && !imageErrors[index] ? (
                        <img
                          src={review.profile_photo_url}
                          alt={review.author_name}
                          className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-md"
                          onError={() => setImageErrors(prev => ({ ...prev, [index]: true }))}
                          loading="lazy"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${getAvatarColor(review.author_name)} flex items-center justify-center border-2 border-white shadow-md`}>
                          <span className="text-white font-bold text-xs">
                            {getInitials(review.author_name)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{review.author_name}</h4>
                          <span className="text-xs text-muted-foreground">
                            {review.relative_time_description}
                          </span>
                        </div>
                        {renderStars(review.rating)}
                      </div>
                    </div>
                    {review.text && (
                      <p className="text-sm text-muted-foreground">{review.text}</p>
                    )}
                  </div>
                ))}
              </div>

              {reviewsCache.reviews?.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  + {reviewsCache.reviews.length - 5} more reviews
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Features Info */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">What you get with Google Reviews</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Display authentic Google reviews on your store</li>
                  <li>• Build trust and credibility with customers</li>
                  <li>• Automatic daily review updates (cached for cost savings)</li>
                  <li>• Multiple display widgets (carousel, grid, badge, list)</li>
                  <li>• Professional Google-branded design</li>
                  <li>• Mobile-responsive layouts</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
};

export default AdminGoogleReviews;
