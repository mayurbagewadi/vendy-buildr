/**
 * AI Designer Edge Function
 * Handles AI-powered UI/UX design generation using Kimi K2.5 via OpenRouter
 * All API keys handled server-side for security
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';
const TOKEN_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action, store_id, user_id, prompt, design, history_id } = body;

    // ============================================
    // GET TOKEN BALANCE
    // ============================================
    if (action === 'get_token_balance') {
      const now = new Date().toISOString();

      // Mark expired tokens
      await supabase
        .from('ai_token_purchases')
        .update({ status: 'expired' })
        .eq('store_id', store_id)
        .eq('status', 'active')
        .lt('expires_at', now)
        .not('expires_at', 'is', null);

      // Delete expired token records (per user preference)
      await supabase
        .from('ai_token_purchases')
        .delete()
        .eq('store_id', store_id)
        .eq('status', 'expired');

      const { data: purchases } = await supabase
        .from('ai_token_purchases')
        .select('tokens_remaining, expires_at, purchased_at')
        .eq('store_id', store_id)
        .eq('status', 'active')
        .order('expires_at', { ascending: true, nullsFirst: false });

      const totalRemaining = (purchases || []).reduce((sum, p) => sum + (p.tokens_remaining || 0), 0);
      const earliestExpiry = purchases && purchases.length > 0 ? purchases[0].expires_at : null;

      return new Response(
        JSON.stringify({
          success: true,
          tokens_remaining: totalRemaining,
          expires_at: earliestExpiry,
          has_tokens: totalRemaining > 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // GENERATE DESIGN
    // ============================================
    if (action === 'generate_design') {
      if (!store_id || !user_id || !prompt) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required fields: store_id, user_id, prompt' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const now = new Date().toISOString();

      // Expire old tokens
      await supabase
        .from('ai_token_purchases')
        .update({ status: 'expired' })
        .eq('store_id', store_id)
        .eq('status', 'active')
        .lt('expires_at', now)
        .not('expires_at', 'is', null);

      await supabase
        .from('ai_token_purchases')
        .delete()
        .eq('store_id', store_id)
        .eq('status', 'expired');

      // Check token balance
      const { data: purchases } = await supabase
        .from('ai_token_purchases')
        .select('id, tokens_remaining')
        .eq('store_id', store_id)
        .eq('status', 'active')
        .gt('tokens_remaining', 0)
        .order('expires_at', { ascending: true, nullsFirst: false })
        .limit(1);

      if (!purchases || purchases.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No tokens remaining. Please purchase tokens to continue.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
        );
      }

      const activePurchase = purchases[0];

      // Get OpenRouter API key from platform settings
      const { data: platformSettings } = await supabase
        .from('platform_settings')
        .select('openrouter_api_key')
        .eq('id', SETTINGS_ID)
        .single();

      const apiKey = platformSettings?.openrouter_api_key;

      if (!apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'OpenRouter API key not configured. Please ask the platform admin to add it in Platform Settings.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Get store context
      const { data: store } = await supabase
        .from('stores')
        .select('name, description, slug')
        .eq('id', store_id)
        .single();

      const storeName = store?.name || 'My Store';
      const storeDescription = store?.description || '';

      // System prompt - instructs AI to return CSS/design code changes
      const systemPrompt = `You are an expert UI/UX designer for e-commerce stores built with React, Tailwind CSS, and CSS custom properties.

The store uses these CSS variables (HSL format) that you can change:
- --primary: controls main brand color (buttons, links, accents)
- --background: page background color
- --foreground: main text color
- --card: card background color
- --muted: subtle background (sections, tags)
- --muted-foreground: secondary text
- --border: border color
- --radius: border radius (e.g. 0.5rem, 0.75rem, 1rem)

Store sections available: header, hero-banner, categories, featured-products, new-arrivals, instagram-reels, google-reviews, cta-banner, footer

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.

Response format:
{
  "summary": "Brief description of changes made",
  "css_variables": {
    "--primary": "HSL values only e.g. 142 71% 45%",
    "--background": "HSL values only",
    "--foreground": "HSL values only",
    "--card": "HSL values only",
    "--muted": "HSL values only",
    "--muted-foreground": "HSL values only",
    "--border": "HSL values only",
    "--radius": "value with unit e.g. 1rem"
  },
  "dark_css_variables": {
    "--primary": "HSL for dark mode",
    "--background": "HSL for dark mode",
    "--foreground": "HSL for dark mode",
    "--card": "HSL for dark mode",
    "--muted": "HSL for dark mode",
    "--muted-foreground": "HSL for dark mode",
    "--border": "HSL for dark mode"
  },
  "layout": {
    "product_grid_cols": "2, 3, or 4",
    "section_padding": "normal or compact or spacious",
    "hero_style": "image or gradient"
  },
  "changes_list": ["Change 1 description", "Change 2 description"]
}

Only include css_variables keys you are actually changing. Leave out unchanged ones.`;

      const userMessage = `Store name: ${storeName}\nStore description: ${storeDescription}\n\nDesign request: ${prompt}`;

      // Call OpenRouter API with Kimi K2.5
      const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://yesgive.shop',
          'X-Title': 'Vendy Buildr AI Designer',
        },
        body: JSON.stringify({
          model: 'moonshotai/kimi-k2',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!aiResponse.ok) {
        const errorData = await aiResponse.json();
        console.error('OpenRouter error:', errorData);
        return new Response(
          JSON.stringify({ success: false, error: `AI API error: ${errorData.error?.message || 'Failed to generate design'}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      const aiData = await aiResponse.json();
      const aiContent = aiData.choices?.[0]?.message?.content;

      if (!aiContent) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI returned empty response' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      let parsedDesign;
      try {
        parsedDesign = JSON.parse(aiContent);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'AI returned invalid JSON response' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Deduct 1 token from the active purchase
      const { data: currentPurchase } = await supabase
        .from('ai_token_purchases')
        .select('tokens_used')
        .eq('id', activePurchase.id)
        .single();

      await supabase
        .from('ai_token_purchases')
        .update({
          tokens_remaining: activePurchase.tokens_remaining - 1,
          tokens_used: (currentPurchase?.tokens_used || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activePurchase.id);

      // Save to history
      const { data: historyRecord } = await supabase
        .from('ai_designer_history')
        .insert({
          store_id,
          user_id,
          prompt,
          ai_response: parsedDesign,
          tokens_used: 1,
          applied: false,
        })
        .select('id')
        .single();

      // Get updated token balance
      const { data: updatedPurchases } = await supabase
        .from('ai_token_purchases')
        .select('tokens_remaining')
        .eq('store_id', store_id)
        .eq('status', 'active');

      const newBalance = (updatedPurchases || []).reduce((sum, p) => sum + (p.tokens_remaining || 0), 0);

      return new Response(
        JSON.stringify({
          success: true,
          design: parsedDesign,
          history_id: historyRecord?.id,
          tokens_remaining: newBalance,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // APPLY DESIGN (Publish)
    // ============================================
    if (action === 'apply_design') {
      if (!store_id || !design) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing store_id or design' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Upsert store design state
      const { error } = await supabase
        .from('store_design_state')
        .upsert({
          store_id,
          current_design: design,
          last_applied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'store_id' });

      if (error) {
        console.error('Apply design error:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Mark history record as applied
      if (history_id) {
        await supabase
          .from('ai_designer_history')
          .update({ applied: true })
          .eq('id', history_id);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Design applied to your live store' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // RESET DESIGN (back to platform default)
    // ============================================
    if (action === 'reset_design') {
      if (!store_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing store_id' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Delete design state → store falls back to hardcoded platform defaults
      await supabase
        .from('store_design_state')
        .delete()
        .eq('store_id', store_id);

      return new Response(
        JSON.stringify({ success: true, message: 'Store design reset to platform default' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error: any) {
    console.error('AI Designer function error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unexpected error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
