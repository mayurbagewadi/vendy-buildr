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

// Robustly extract JSON from AI response — handles markdown wrappers, extra text, etc.
function extractJSON(content: string): any {
  // 1. Try direct parse first
  try { return JSON.parse(content); } catch {}
  // 2. Try stripping markdown code fences ```json ... ``` or ``` ... ```
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }
  // 3. Try extracting from first { to last }
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(content.slice(start, end + 1)); } catch {}
  }
  throw new Error('Could not parse AI response as JSON');
}

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
    const { action, store_id, user_id, prompt, design, history_id, package_id, amount, currency } = body;

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
        .select('openrouter_api_key, openrouter_model')
        .eq('id', SETTINGS_ID)
        .single();

      const apiKey = platformSettings?.openrouter_api_key;
      const aiModel = platformSettings?.openrouter_model || 'moonshotai/kimi-k2';

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
      const genAbort = new AbortController();
      const genTimeout = setTimeout(() => genAbort.abort(), 45000);

      let aiResponse: Response;
      try {
        aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://yesgive.shop',
            'X-Title': 'Vendy Buildr AI Designer',
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 1000,
          }),
          signal: genAbort.signal,
        });
      } catch (fetchErr: any) {
        clearTimeout(genTimeout);
        const msg = fetchErr?.name === 'AbortError' ? 'AI request timed out. Please try again.' : 'Failed to reach AI service.';
        return new Response(
          JSON.stringify({ success: false, error: msg }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      clearTimeout(genTimeout);

      if (!aiResponse.ok) {
        const errText = await aiResponse.text().catch(() => '');
        let errMsg = 'Failed to generate design';
        try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch {}
        console.error('OpenRouter generate_design error:', aiResponse.status, errText.slice(0, 200));
        return new Response(
          JSON.stringify({ success: false, error: `AI API error (${aiResponse.status}): ${errMsg}` }),
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
        parsedDesign = extractJSON(aiContent);
      } catch {
        console.error('generate_design JSON parse failed. Raw content:', aiContent?.slice(0, 300));
        return new Response(
          JSON.stringify({ success: false, error: 'AI returned invalid response. Please try again.' }),
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
    // CHAT (Conversational AI with design capability)
    // ============================================
    if (action === 'chat') {
      const { messages } = body; // array of {role: 'user'|'assistant', content: string}

      if (!store_id || !user_id || !messages || !messages.length) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required fields' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Get OpenRouter API key
      const { data: platformSettings } = await supabase
        .from('platform_settings')
        .select('openrouter_api_key, openrouter_model')
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

      const systemPrompt = `You are an expert AI designer and consultant for an e-commerce store called "${storeName}"${storeDescription ? ` — ${storeDescription}` : ''}.

You have full access to the store's frontend source code and structure below. Use it to give precise, accurate design suggestions.

===== STORE FRONTEND STRUCTURE =====
Framework: React + Tailwind CSS + CSS custom properties (HSL values)

--- AI-CONTROLLED LAYOUT VARIABLES ---
product_grid_cols: "2" | "3" | "4"
  "2" → grid grid-cols-2 sm:grid-cols-2 gap-6
  "3" → grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-6
  "4" (default) → grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6

section_padding: "compact" | "normal" | "spacious"
  compact → py-8 / py-10, spacious → py-24 / py-28, normal → py-16 / py-20

hero_style: "image" (default) | "gradient"
  gradient → bg-gradient-to-br from-primary/20 via-background to-muted

--- SECTION 1: HEADER ---
Component: <Header storeSlug storeId />
Classes: bg-background border-b border-border sticky top-0 z-50
Contains: logo, store name, nav links, cart icon

--- SECTION 2: HERO BANNER ---
Component: <HeroBannerCarousel />
hero_style controls: "image" shows uploaded banner, "gradient" shows branded gradient

--- SECTION 3: CATEGORIES ---
Condition: shows if categories exist
Section: data-ai="section-categories" \`\${sectionPyLarge} bg-gradient-to-b from-muted/30 to-background\`
Title: "Shop by Category" → text-4xl md:text-5xl font-bold text-foreground mb-4
Subtitle: text-lg text-muted-foreground
Layout: horizontal scroll flex gap-2 overflow-x-auto snap-x snap-mandatory
Each card: flex-shrink-0 w-48 snap-center, bg-card border border-border rounded-[--radius]

--- SECTION 4: FEATURED PRODUCTS ---
Section: \`\${sectionPy} bg-background\`
Title: "Featured Products" → text-3xl font-bold text-foreground mb-2
Subtitle: "Check out our top picks for you" → text-muted-foreground
Grid: \${gridColsClass} (AI-controlled columns)
Product card: bg-card border border-border rounded-[--radius] overflow-hidden
  Image: aspect-square object-cover, hover: y:-8 scale:1.05 (Framer Motion)
  Price: text-primary font-bold
  Category badge: bg-muted text-muted-foreground text-xs rounded-full px-2 py-1

--- SECTION 5: INSTAGRAM REELS ---
Conditional. Component: <InstagramReels />. bg-background py-16

--- SECTION 6: GOOGLE REVIEWS ---
Section: \`\${sectionPy} bg-muted/30\`
Review cards: bg-card border border-border rounded-[--radius] p-4
Star color follows --primary

--- SECTION 7: NEW ARRIVALS ---
Condition: shows if new products exist
Section: \`\${sectionPy}\` (no extra bg)
Title: "New Arrivals" → text-3xl font-bold text-foreground mb-2
Grid: same \${gridColsClass} as featured products

--- SECTION 8: CTA BANNER ---
Section: py-20 bg-primary text-primary-foreground
Title: text-3xl md:text-4xl font-bold mb-4 → "Ready to Start Shopping?"
Subtitle: text-xl mb-8 opacity-90
Buttons: variant="secondary" size="lg"

--- SECTION 9: FOOTER ---
Component: <StoreFooter />
Classes: bg-card border-t border-border py-12
Links: text-muted-foreground hover:text-foreground
Bottom bar: bg-muted/50 py-4 text-center text-sm text-muted-foreground

--- CURRENT CSS VARIABLES (defaults) ---
:root {
  --primary: 217 91% 60%;         /* blue — buttons, links, accents, CTA bg, star color */
  --background: 0 0% 100%;        /* page background, header bg */
  --foreground: 222 47% 11%;      /* main text, headings */
  --card: 0 0% 100%;              /* product cards, review cards, footer bg */
  --muted: 210 40% 96%;           /* category section bg, review section bg, badges */
  --muted-foreground: 215 16% 47%;/* secondary text, subtitles, badge text */
  --border: 214 32% 91%;          /* card borders, header border, footer border */
  --radius: 0.5rem;               /* all card/button border radius */
}
===== END STORE STRUCTURE =====

You can change:
1. css_variables → any :root variable above (HSL values only, no hsl() wrapper)
2. dark_css_variables → .dark mode overrides
3. layout.product_grid_cols → "2" | "3" | "4"
4. layout.section_padding → "compact" | "normal" | "spacious"
5. layout.hero_style → "image" | "gradient"
6. css_overrides → raw CSS string injected into the store page. Use data-ai selectors to target sections precisely.

   SECTION SELECTORS (target entire sections):
   - [data-ai="section-hero"]           → Hero banner section
   - [data-ai="section-categories"]     → Categories section (has bg-gradient-to-b from-muted/30 to-background)
   - [data-ai="section-featured"]       → Featured Products section (bg-background)
   - [data-ai="section-reviews"]        → Google Reviews section (bg-muted/30)
   - [data-ai="section-new-arrivals"]   → New Arrivals section
   - [data-ai="section-cta"]            → CTA banner section (bg-primary text-primary-foreground)
   - [data-ai="section-reels"]          → Instagram Reels section
   - [data-ai="section-footer"]         → Footer (bg-muted border-t border-border, 4-col grid)

   CARD SELECTORS (target individual cards):
   - [data-ai="category-card"]          → each category card wrapper
   - [data-ai="category-card"] .rounded-2xl → card outer border-radius
   - [data-ai="category-card"] .rounded-xl  → image container border-radius
   - [data-ai="product-card"]           → each product card wrapper
   - [data-ai="product-card"] .card     → product card inner element

   ELEMENT SELECTORS (target text/buttons inside sections):
   - [data-ai="section-categories"] h2  → "Shop by Category" title (text-4xl md:text-5xl)
   - [data-ai="section-categories"] p   → subtitle text
   - [data-ai="section-featured"] h2    → "Featured Products" title (text-3xl)
   - [data-ai="section-new-arrivals"] h2 → "New Arrivals" title (text-3xl)
   - [data-ai="section-cta"] h2         → CTA title text
   - [data-ai="section-footer"] footer  → footer background/border
   - [data-ai="product-card"] .text-lg  → product price (text-primary font-bold)
   - [data-ai="product-card"] img       → product image

   EXAMPLES:
   Make category cards circular:
   "[data-ai='category-card'] .rounded-2xl, [data-ai='category-card'] .rounded-xl { border-radius: 9999px !important; }"

   Change categories section background:
   "[data-ai='section-categories'] { background: linear-gradient(to bottom, hsl(var(--primary)/0.1), hsl(var(--background))) !important; }"

   Make section titles bigger:
   "[data-ai='section-featured'] h2, [data-ai='section-new-arrivals'] h2 { font-size: 2.5rem !important; }"

   Add shadow to product cards:
   "[data-ai='product-card'] .card { box-shadow: 0 8px 30px hsl(var(--primary)/0.15) !important; }"

   Dark footer:
   "[data-ai='section-footer'] { background: hsl(222 47% 8%) !important; color: hsl(0 0% 95%) !important; }"

   Change CTA section padding/style:
   "[data-ai='section-cta'] { padding: 5rem 0 !important; background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.7)) !important; }"

IMPORTANT: Always respond in valid JSON only. No markdown, no text outside JSON.

If the user is asking for suggestions, advice, ideas, or general questions, respond with:
{
  "type": "text",
  "message": "Your helpful conversational response here. Be specific, reference actual section names and classes from the store structure above."
}

If the user wants you to apply/generate/create/change a design, respond with:
{
  "type": "design",
  "message": "Brief friendly explanation of what you changed and why",
  "design": {
    "summary": "Brief description of the design",
    "css_variables": {
      "--primary": "142 71% 45%"
    },
    "dark_css_variables": {
      "--primary": "142 71% 50%"
    },
    "layout": {
      "product_grid_cols": "3",
      "section_padding": "normal",
      "hero_style": "gradient"
    },
    "css_overrides": "[data-ai='category-card'] * { border-radius: 9999px !important; }",
    "changes_list": ["Changed primary color to green", "Made category cards circular"]
  }
}

Only include fields you are actually changing. css_overrides is optional — only include it when raw CSS is needed for shape/style changes beyond what css_variables can do. Be helpful, creative and specific.`;

      const chatAbort = new AbortController();
      const chatTimeout = setTimeout(() => chatAbort.abort(), 45000);

      let chatAiResponse: Response;
      try {
        chatAiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://yesgive.shop',
            'X-Title': 'Vendy Buildr AI Designer',
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 1200,
          }),
          signal: chatAbort.signal,
        });
      } catch (fetchErr: any) {
        clearTimeout(chatTimeout);
        const msg = fetchErr?.name === 'AbortError' ? 'AI request timed out. Please try again.' : 'Failed to reach AI service.';
        return new Response(
          JSON.stringify({ success: false, error: msg }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      clearTimeout(chatTimeout);

      if (!chatAiResponse.ok) {
        const errText = await chatAiResponse.text().catch(() => '');
        let errMsg = 'Failed to get AI response';
        try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch {}
        console.error('OpenRouter chat error:', chatAiResponse.status, errText.slice(0, 200));
        return new Response(
          JSON.stringify({ success: false, error: `AI API error (${chatAiResponse.status}): ${errMsg}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      const aiData = await chatAiResponse.json();
      const aiContent = aiData.choices?.[0]?.message?.content;

      let parsed;
      try {
        parsed = extractJSON(aiContent);
      } catch {
        console.error('chat JSON parse failed. Raw content:', aiContent?.slice(0, 300));
        return new Response(
          JSON.stringify({ success: false, error: 'AI returned invalid response. Please try again.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // If design was generated, deduct a token and save to history
      let historyId;
      let newTokenBalance;

      if (parsed.type === 'design' && parsed.design) {
        const now = new Date().toISOString();

        await supabase.from('ai_token_purchases').update({ status: 'expired' })
          .eq('store_id', store_id).eq('status', 'active').lt('expires_at', now).not('expires_at', 'is', null);
        await supabase.from('ai_token_purchases').delete()
          .eq('store_id', store_id).eq('status', 'expired');

        const { data: purchases } = await supabase
          .from('ai_token_purchases')
          .select('id, tokens_remaining')
          .eq('store_id', store_id).eq('status', 'active').gt('tokens_remaining', 0)
          .order('expires_at', { ascending: true, nullsFirst: false }).limit(1);

        if (!purchases || purchases.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'No tokens remaining. Please purchase tokens to continue.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
          );
        }

        const activePurchase = purchases[0];
        const { data: currentPurchase } = await supabase
          .from('ai_token_purchases').select('tokens_used').eq('id', activePurchase.id).single();

        await supabase.from('ai_token_purchases').update({
          tokens_remaining: activePurchase.tokens_remaining - 1,
          tokens_used: (currentPurchase?.tokens_used || 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', activePurchase.id);

        const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
        const { data: historyRecord } = await supabase
          .from('ai_designer_history')
          .insert({ store_id, user_id, prompt: lastUserMsg?.content || '', ai_response: parsed.design, tokens_used: 1, applied: false })
          .select('id').single();
        historyId = historyRecord?.id;

        const { data: updatedPurchases } = await supabase
          .from('ai_token_purchases').select('tokens_remaining')
          .eq('store_id', store_id).eq('status', 'active');
        newTokenBalance = (updatedPurchases || []).reduce((sum: number, p: any) => sum + (p.tokens_remaining || 0), 0);
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: parsed.type,
          message: parsed.message,
          design: parsed.design || null,
          history_id: historyId,
          tokens_remaining: newTokenBalance,
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

    // ============================================
    // CREATE PAYMENT ORDER (Platform Razorpay)
    // ============================================
    if (action === 'create_payment_order') {
      if (!amount || !currency || !package_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required fields: amount, currency, package_id' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Get platform Razorpay credentials from platform_settings (server-side only)
      const { data: platformSettings } = await supabase
        .from('platform_settings')
        .select('razorpay_key_id, razorpay_key_secret')
        .eq('id', SETTINGS_ID)
        .single();

      const keyId = platformSettings?.razorpay_key_id;
      const keySecret = platformSettings?.razorpay_key_secret;

      if (!keyId || !keySecret) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment not configured. Please contact support.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Amount must be in paise (multiply rupees by 100)
      const amountInPaise = Math.round(amount * 100);

      const orderData = {
        amount: amountInPaise,
        currency,
        receipt: `ai_tok_${Date.now().toString().slice(-10)}`, // Max 40 chars (Razorpay limit)
        notes: { type: 'ai_tokens', package_id, store_id },
      };

      const basicAuth = btoa(`${keyId}:${keySecret}`);
      const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (!razorpayResponse.ok) {
        const err = await razorpayResponse.text();
        console.error('Razorpay error:', err);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create payment order' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      const razorpayOrder = await razorpayResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          order_id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          razorpay_key_id: keyId, // key_id is public-safe (publishable key)
        }),
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
