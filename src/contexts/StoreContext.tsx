import { createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPalette, buildPaletteCSS } from '@/lib/colorPalettes';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoreContextData {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  custom_domain: string | null;
  description: string | null;
  logo_url: string | null;
  hero_banner_url: string | null;
  hero_banner_urls: string[] | null;
  whatsapp_number: string | null;
  whatsapp_float_enabled: boolean | null;
  address: string | null;
  storefront_theme: string | null;
  storefront_color_palette: string | null;
  social_links: Record<string, string | null> | null;
  policies: Record<string, string | null> | null;
  facebook_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
  storefront_template: string | null;
  free_delivery_above: number | null;
  promo_bar_text: string | null;
  user_id: string;
  [key: string]: unknown;
}

export interface StoreProfileData {
  phone: string | null;
  email: string | null;
}

export interface StoreContextValue {
  store: StoreContextData | null;
  profile: StoreProfileData | null;
  storeId: string | null;
  storeSlug: string | null;
  loading: boolean;
}

// ─── Session cache (5-min TTL) ────────────────────────────────────────────────

const CACHE_PREFIX = 'dd_sf_';
const CACHE_TTL = 5 * 60 * 1000;

interface CachedEntry {
  store: StoreContextData;
  profile: StoreProfileData | null;
  cachedAt: number;
}

function readCache(slug: string): CachedEntry | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + slug);
    if (!raw) return null;
    const entry: CachedEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_PREFIX + slug);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writeCache(slug: string, store: StoreContextData, profile: StoreProfileData | null) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + slug, JSON.stringify({ store, profile, cachedAt: Date.now() }));
  } catch { /* storage full or disabled — degrade gracefully */ }
}

// ─── Theme application ────────────────────────────────────────────────────────

function applyColorPalette(paletteId: string | null) {
  const palette = getPalette(paletteId);
  const css = buildPaletteCSS(palette);
  const STYLE_ID = 'dd-palette-styles';
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

// BUG-6 fix: per-store key so Store A's toggle never bleeds into Store B
// on the same origin (e.g. yesgive.shop/store-a vs yesgive.shop/store-b).
export const visitorThemeKey = (slug: string | null | undefined): string =>
  slug ? `dd_visitor_theme_${slug}` : 'dd_visitor_theme';

function applyTheme(ownerTheme: string | null, slug?: string | null) {
  // Visitor's manual choice always wins over owner's default.
  const key = visitorThemeKey(slug);
  const visitorChoice = localStorage.getItem(key);
  const effective = (visitorChoice === 'light' || visitorChoice === 'dark' || visitorChoice === 'system')
    ? visitorChoice
    : ownerTheme;

  const resolved =
    effective === 'light' ? 'light' :
    effective === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') :
    'dark';

  const html = document.documentElement;
  html.classList.remove('dark', 'light');
  html.classList.add(resolved);
  html.style.colorScheme = resolved;
  // Keep next-themes in sync so the toggle icon shows the correct state.
  localStorage.setItem('theme', resolved);
}

function applyTemplate(templateId: string | null) {
  const html = document.documentElement;
  const resolved = templateId || 'default';
  html.setAttribute('data-storefront-template', resolved);
}

function storeMatchesIdentifier(store: StoreContextData | null, identifier: string | null | undefined): boolean {
  if (!store || !identifier) return false;
  return identifier.includes('.')
    ? store.custom_domain === identifier || store.subdomain === identifier
    : store.subdomain === identifier || store.slug === identifier;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ slug, children }: { slug?: string | null; children: ReactNode }) {
  const cached = slug ? readCache(slug) : null;

  const [store, setStore] = useState<StoreContextData | null>(cached?.store ?? null);
  const [profile, setProfile] = useState<StoreProfileData | null>(cached?.profile ?? null);
  const [loading, setLoading] = useState(!cached);
  const storeMatchesCurrentSlug = storeMatchesIdentifier(store, slug);
  const activeStore = storeMatchesCurrentSlug ? store : null;
  const activeProfile = storeMatchesCurrentSlug ? profile : null;

  // Apply theme synchronously before paint when we have cached data.
  // This fires before useEffect, so it wins on cached sessions (zero flash).
  useLayoutEffect(() => {
    if (store && storeMatchesIdentifier(store, slug)) {
      applyColorPalette(store.storefront_color_palette ?? null);
      applyTheme(store.storefront_theme ?? null, slug);
      applyTemplate(store.storefront_template ?? null);
    } else {
      applyColorPalette(null);
      applyTemplate(null);
    }
  }, [store?.storefront_theme, store?.storefront_color_palette, store?.storefront_template, slug]);

  // BUG-7 fix: when owner sets System theme, listen for OS dark/light changes
  // mid-session so the store updates without requiring a page reload.
  useEffect(() => {
    if (!store || store.storefront_theme !== 'system') return;
    const key = visitorThemeKey(slug);
    if (localStorage.getItem(key)) return; // visitor override takes precedence
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system', slug);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [store?.storefront_theme, store?.id, slug]);

  // Restore dark (admin default) only when the entire storefront section unmounts
  // (i.e. user navigates to admin). Does NOT run between customer page navigations
  // because this provider stays mounted throughout the storefront session.
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      document.documentElement.removeAttribute('data-storefront-template');
      const paletteEl = document.getElementById('dd-palette-styles');
      if (paletteEl) paletteEl.remove();
    };
  }, []);

  // Inject per-store Google Analytics — deferred to idle to protect LCP.
  // Guard key is per-store-id so multi-store navigation injects each store's GA correctly.
  useEffect(() => {
    if (!store?.id) return;
    const gaId = store['ga_measurement_id'] as string | undefined;
    if (!gaId || !/^G-[A-Z0-9]+$/.test(gaId)) return;
    const guardKey = '__ga_injected_' + store.id;
    if ((window as any)[guardKey]) return;
    (window as any)[guardKey] = true;
    const inject = () => {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + gaId;
      document.head.appendChild(script);
      (window as any).dataLayer = (window as any).dataLayer || [];
      const gtag = (...args: any[]) => { (window as any).dataLayer.push(args); };
      gtag('js', new Date());
      gtag('config', gaId);
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(inject, { timeout: 3000 });
    } else {
      setTimeout(inject, 100);
    }
  }, [store?.id]);

  // Fetch store data. Runs once per slug. Background re-fetch keeps cache warm.
  useEffect(() => {
    if (!slug) {
      setStore(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const cachedForSlug = readCache(slug);

    if (cachedForSlug) {
      setStore(cachedForSlug.store);
      setProfile(cachedForSlug.profile);
      setLoading(false);
    } else {
      setStore(null);
      setProfile(null);
      setLoading(true);
    }

    (async () => {
      try {
        let query = supabase.from('stores').select('*').eq('is_active', true);
        query = slug.includes('.')
          ? query.or(`custom_domain.eq.${slug},subdomain.eq.${slug}`)
          : query.or(`subdomain.eq.${slug},slug.eq.${slug}`);

        const { data: storeData, error } = await query.maybeSingle();
        if (cancelled || error || !storeData) return;

        const { data: profileData } = await supabase
          .from('profiles').select('phone, email')
          .eq('user_id', storeData.user_id).maybeSingle();

        if (cancelled) return;

        writeCache(slug, storeData as StoreContextData, profileData ?? null);
        setStore(storeData as StoreContextData);
        setProfile(profileData ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  const value: StoreContextValue = {
    store: activeStore,
    profile: activeProfile,
    storeId: activeStore?.id ?? null,
    storeSlug: activeStore?.slug ?? slug ?? null,
    loading: loading || Boolean(slug && store && !storeMatchesCurrentSlug),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// Returns safe defaults when called outside a StoreProvider (e.g. admin pages).
export function useStorefront(): StoreContextValue {
  const ctx = useContext(StoreContext);
  return ctx ?? { store: null, profile: null, storeId: null, storeSlug: null, loading: false };
}
