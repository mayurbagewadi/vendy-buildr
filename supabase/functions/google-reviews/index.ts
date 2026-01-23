import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { store_id, google_place_id } = await req.json();

    if (!store_id || !google_place_id) {
      return new Response(
        JSON.stringify({ error: "store_id and google_place_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if user has purchased Google Reviews from marketplace
    const { data: purchase, error: purchaseError } = await supabase
      .from('marketplace_purchases')
      .select('*')
      .eq('store_id', store_id)
      .eq('feature_slug', 'google-reviews')
      .eq('status', 'active')
      .single();

    if (purchaseError || !purchase) {
      return new Response(
        JSON.stringify({
          error: "Google Reviews not purchased",
          details: "Please purchase Google Reviews from the Marketplace to use this feature."
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if subscription expired (for monthly/yearly plans)
    if (purchase.expires_at) {
      const expiresAt = new Date(purchase.expires_at);
      const now = new Date();
      if (now > expiresAt) {
        // Mark as expired
        await supabase
          .from('marketplace_purchases')
          .update({ status: 'expired' })
          .eq('id', purchase.id);

        return new Response(
          JSON.stringify({
            error: "Subscription expired",
            details: "Your Google Reviews subscription has expired. Please renew to continue."
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const callsLimit = purchase.quota_limit || 15;
    const period = 'monthly'; // Always monthly for now

    // Check if quota needs reset
    const lastReset = new Date(purchase.last_reset);
    const now = new Date();
    let needsReset = false;

    // Always reset monthly for marketplace purchases
    needsReset = lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear();

    let callsUsed = purchase.calls_used || 0;

    // Reset counter if needed
    if (needsReset) {
      callsUsed = 0;
      await supabase
        .from('marketplace_purchases')
        .update({
          calls_used: 0,
          last_reset: now.toISOString()
        })
        .eq('id', purchase.id);
    }

    // Check if quota exceeded
    if (callsUsed >= callsLimit) {
      return new Response(
        JSON.stringify({
          error: "API call quota exceeded",
          details: `You have used ${callsUsed}/${callsLimit} calls for this ${period === 'monthly' ? 'month' : 'year'}. Upgrade your plan or wait for quota reset.`,
          quota: {
            used: callsUsed,
            limit: callsLimit,
            period: period,
            resets_at: period === 'monthly'
              ? new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
              : new Date(now.getFullYear() + 1, 0, 1).toISOString()
          }
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Google Places API key from environment
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Google Places API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch reviews from Google Places API
    // Note: Google Places API returns max 5 reviews, sorted by relevance (not date)
    // Adding reviews_sort=newest attempts to get recent reviews (undocumented parameter)
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${google_place_id}&fields=name,rating,user_ratings_total,reviews&reviews_sort=newest&key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK") {
      return new Response(
        JSON.stringify({ error: `Google API error: ${data.status}`, details: data.error_message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = data.result;
    const reviews = result.reviews || [];

    // Enhanced logging for debugging
    console.log('=== Google Reviews Fetch Debug ===');
    console.log('Total reviews on Google:', result.user_ratings_total);
    console.log('Reviews returned by API:', reviews.length);
    if (reviews.length > 0) {
      console.log('Review dates (time):', reviews.map((r: any) => ({
        author: r.author_name,
        time: r.time,
        date: new Date(r.time * 1000).toISOString(),
        relative: r.relative_time_description
      })));
    }
    console.log('================================');

    // Increment API call counter
    await supabase
      .from('marketplace_purchases')
      .update({
        calls_used: callsUsed + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', purchase.id);

    // Save to database (upsert - insert or update)
    const { data: cached, error } = await supabase
      .from("google_reviews_cache")
      .upsert({
        store_id,
        google_place_id,
        average_rating: result.rating || 0,
        total_reviews: result.user_ratings_total || 0,
        reviews: reviews.map((review: any) => ({
          author_name: review.author_name,
          rating: review.rating,
          text: review.text,
          time: review.time,
          profile_photo_url: review.profile_photo_url,
          relative_time_description: review.relative_time_description,
        })),
        last_fetched: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'store_id'
      })
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to save reviews to database", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: cached,
        message: "Reviews fetched and cached successfully",
        quota: {
          used: callsUsed + 1,
          limit: callsLimit,
          remaining: callsLimit - (callsUsed + 1),
          period: period
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
