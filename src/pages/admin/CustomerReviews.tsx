import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Star, Loader2, MessageSquare, Lock, AlertCircle, Pencil, Trash2, Plus, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// New table/column are not in generated Supabase types yet.
const db = supabase as any;

const FEATURE_SLUG = "customer-reviews";
const MAX_REVIEWS = 20;

interface CustomerReview {
  id: string;
  customer_name: string;
  rating: number;
  review_text: string;
  review_date: string;
  is_visible: boolean;
}

// Local date (not UTC) so "today" matches the owner's calendar.
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const reviewSchema = z.object({
  customer_name: z.string().trim().min(1, "Customer name is required").max(80, "Name must be 80 characters or less"),
  rating: z.number().int().min(1, "Choose a star rating").max(5),
  review_text: z.string().trim().min(1, "Review text is required").max(1000, "Review must be 1000 characters or less"),
  review_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date")
    .refine((d) => d <= todayISO(), "Date cannot be in the future"),
});

// Only Google-owned hosts, so the store button can't point shoppers elsewhere.
const isGoogleReviewsUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host) ||
      host === "goo.gl" ||
      host === "maps.app.goo.gl" ||
      host === "g.page" ||
      host === "g.co"
    );
  } catch {
    return false;
  }
};

const emptyForm = () => ({ customer_name: "", rating: 0, review_text: "", review_date: todayISO() });

const AdminCustomerReviews = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [installed, setInstalled] = useState(false);
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [googleUrl, setGoogleUrl] = useState("");
  const [savedGoogleUrl, setSavedGoogleUrl] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerReview | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: store, error } = await db
        .from("stores")
        .select("id, enabled_features, customer_reviews_google_url")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) throw error;
      if (!store) return;

      setStoreId(store.id);
      setGoogleUrl(store.customer_reviews_google_url || "");
      setSavedGoogleUrl(store.customer_reviews_google_url || "");
      const isInstalled = ((store.enabled_features as string[]) || []).includes(FEATURE_SLUG);
      setInstalled(isInstalled);

      if (isInstalled) {
        const { data: rows, error: reviewsError } = await db
          .from("store_customer_reviews")
          .select("id, customer_name, rating, review_text, review_date, is_visible")
          .eq("store_id", store.id)
          .order("review_date", { ascending: false })
          .order("created_at", { ascending: false });

        if (reviewsError) throw reviewsError;
        setReviews(rows || []);
      }
    } catch (error) {
      console.error("Error loading customer reviews:", error);
      toast({
        title: "Error",
        description: "Failed to load customer reviews",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGoogleUrl = async () => {
    const value = googleUrl.trim();
    if (value && !isGoogleReviewsUrl(value)) {
      toast({
        title: "Invalid link",
        description: "Please paste a Google Maps or Google Business link (starting with https://).",
        variant: "destructive",
      });
      return;
    }

    setSavingUrl(true);
    try {
      const { error } = await db
        .from("stores")
        .update({ customer_reviews_google_url: value || null })
        .eq("id", storeId);

      if (error) throw error;

      setGoogleUrl(value);
      setSavedGoogleUrl(value);
      toast({
        title: "Saved",
        description: value ? "Google reviews link saved." : "Google reviews link removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save link",
        variant: "destructive",
      });
    } finally {
      setSavingUrl(false);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEditForm = (review: CustomerReview) => {
    setEditingId(review.id);
    setForm({
      customer_name: review.customer_name,
      rating: review.rating,
      review_text: review.review_text,
      review_date: review.review_date,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSaveReview = async () => {
    const parsed = reviewSchema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Please check the form",
        description: parsed.error.errors[0]?.message || "Invalid review",
        variant: "destructive",
      });
      return;
    }

    if (!editingId && reviews.length >= MAX_REVIEWS) {
      toast({
        title: "Limit reached",
        description: `You can add up to ${MAX_REVIEWS} reviews. Delete one to add another.`,
        variant: "destructive",
      });
      return;
    }

    setSavingReview(true);
    try {
      if (editingId) {
        const { data, error } = await db
          .from("store_customer_reviews")
          .update(parsed.data)
          .eq("id", editingId)
          .select("id, customer_name, rating, review_text, review_date, is_visible")
          .single();

        if (error) throw error;
        setReviews((prev) => prev.map((r) => (r.id === editingId ? data : r)));
        toast({ title: "Review updated" });
      } else {
        const { data, error } = await db
          .from("store_customer_reviews")
          .insert({ ...parsed.data, store_id: storeId })
          .select("id, customer_name, rating, review_text, review_date, is_visible")
          .single();

        if (error) throw error;
        setReviews((prev) =>
          [data, ...prev].sort((a, b) => b.review_date.localeCompare(a.review_date))
        );
        toast({ title: "Review added" });
      }
      closeForm();
    } catch (error: any) {
      console.error("Error saving review:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save review",
        variant: "destructive",
      });
    } finally {
      setSavingReview(false);
    }
  };

  const handleToggleVisible = async (review: CustomerReview, checked: boolean) => {
    setTogglingId(review.id);
    try {
      const { error } = await db
        .from("store_customer_reviews")
        .update({ is_visible: checked })
        .eq("id", review.id);

      if (error) throw error;
      setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, is_visible: checked } : r)));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update review",
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      const { error } = await db
        .from("store_customer_reviews")
        .delete()
        .eq("id", target.id);

      if (error) throw error;
      setReviews((prev) => prev.filter((r) => r.id !== target.id));
      if (editingId === target.id) closeForm();
      toast({ title: "Review deleted" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete review",
        variant: "destructive",
      });
    }
  };

  const renderStars = (rating: number, onPick?: (value: number) => void) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const icon = (
          <Star
            className={`${onPick ? "h-6 w-6" : "h-4 w-4"} ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"
            }`}
          />
        );
        return onPick ? (
          <button
            key={star}
            type="button"
            onClick={() => onPick(star)}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            className="p-0.5"
          >
            {icon}
          </button>
        ) : (
          <span key={star}>{icon}</span>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!installed) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          Customer Reviews
        </h1>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-4 py-10">
            <div className="p-3 rounded-xl bg-muted">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Customer Reviews is not installed</h3>
              <p className="text-sm text-muted-foreground">
                Install it from the Marketplace to show customer reviews on your store.
              </p>
            </div>
            <Button onClick={() => navigate("/admin/marketplace")}>Go to Marketplace</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const visibleReviews = reviews.filter((r) => r.is_visible);
  const averageRating = visibleReviews.length
    ? (visibleReviews.reduce((sum, r) => sum + r.rating, 0) / visibleReviews.length).toFixed(1)
    : null;
  const limitReached = reviews.length >= MAX_REVIEWS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Customer Reviews
          </h1>
          <p className="text-muted-foreground">Show genuine reviews from your customers on your store</p>
        </div>
        <div className="flex items-center gap-2">
          {averageRating && (
            <Badge variant="outline" className="text-yellow-700 border-yellow-500">
              <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
              {averageRating}
            </Badge>
          )}
          <Badge variant="outline">
            {reviews.length} / {MAX_REVIEWS} used
          </Badge>
        </div>
      </div>

      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          Add only reviews from your Google Business page. Copy the name, stars, text and date exactly. Fake reviews mislead shoppers and are against consumer protection rules.
        </AlertDescription>
      </Alert>

      {/* Google link */}
      <Card>
        <CardHeader>
          <CardTitle>Google Reviews Link</CardTitle>
          <CardDescription>
            Optional. Shows a "See all reviews on Google" button under your reviews.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="customer_reviews_google_url">Google Maps / Business link</Label>
          <Input
            id="customer_reviews_google_url"
            type="url"
            maxLength={500}
            placeholder="https://maps.app.goo.gl/xxxxx"
            value={googleUrl}
            onChange={(e) => setGoogleUrl(e.target.value)}
          />
          <Button onClick={handleSaveGoogleUrl} disabled={savingUrl} className="w-full md:w-auto">
            {savingUrl && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {savingUrl ? "Saving..." : "Save Link"}
          </Button>
        </CardContent>
      </Card>

      {/* Add / Edit form */}
      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Review" : "Add Review"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cr_name">Customer name</Label>
              <Input
                id="cr_name"
                maxLength={80}
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Stars</Label>
              {renderStars(form.rating, (value) => setForm({ ...form, rating: value }))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr_text">Review</Label>
              <Textarea
                id="cr_text"
                rows={4}
                maxLength={1000}
                value={form.review_text}
                onChange={(e) => setForm({ ...form, review_text: e.target.value })}
              />
              <p className="text-xs text-muted-foreground text-right">{form.review_text.length} / 1000</p>
            </div>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="cr_date">Review date</Label>
              <Input
                id="cr_date"
                type="date"
                max={todayISO()}
                value={form.review_date}
                onChange={(e) => setForm({ ...form, review_date: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveReview} disabled={savingReview}>
                {savingReview && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "Save Changes" : "Add Review"}
              </Button>
              <Button variant="outline" onClick={closeForm} disabled={savingReview}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Button onClick={openAddForm} disabled={limitReached}>
            <Plus className="h-4 w-4 mr-2" />
            Add Review
          </Button>
          {limitReached && (
            <p className="text-sm text-muted-foreground">
              Limit of {MAX_REVIEWS} reached. Delete a review to add a new one.
            </p>
          )}
        </div>
      )}

      {/* Reviews list */}
      <Card>
        <CardHeader>
          <CardTitle>Your Reviews</CardTitle>
          <CardDescription>
            Hidden reviews are not shown on your store. If no reviews are visible, the reviews section is hidden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No reviews yet.</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className={`p-4 border rounded-lg space-y-2 ${review.is_visible ? "" : "opacity-60"}`}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-medium truncate">{review.customer_name}</h4>
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(`${review.review_date}T00:00:00`).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{review.is_visible ? "Shown" : "Hidden"}</span>
                    <Switch
                      checked={review.is_visible}
                      disabled={togglingId === review.id}
                      onCheckedChange={(checked) => handleToggleVisible(review, checked)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => openEditForm(review)} aria-label="Edit review">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(review)} aria-label="Delete review">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{review.review_text}</p>
              </div>
            ))
          )}
          {googleUrl && isGoogleReviewsUrl(googleUrl) && (
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline pt-2"
            >
              Test your Google link <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this review?</AlertDialogTitle>
            <AlertDialogDescription>
              The review from {deleteTarget?.customer_name} will be removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCustomerReviews;
