import { createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  social_links: Record<string, string | null> | null;
  policies: Record<string, string | null> | null;
  facebook_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
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

function applyTheme(theme: string | null) {
  const resolved =
    theme === 'light' ? 'light' :
    theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') :
    'dark';
  const html = document.documentElement;
  html.classList.remove('dark', 'light');
  html.classList.add(resolved);
  html.style.colorScheme = resolved;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ slug, children }: { slug?: string | null; children: ReactNode }) {
  const cached = slug ? readCache(slug) : null;

  const [store, setStore] = useState<StoreContextData | null>(cached?.store ?? null);
  const [profile, setProfile] = useState<StoreProfileData | null>(cached?.profile ?? null);
  const [loading, setLoading] = useState(!cached);

  // Apply theme synchronously before paint when we have cached data.
  // This fires before useEffect, so it wins on cached sessions (zero flash).
  useLayoutEffect(() => {
    if (store) applyTheme(store.storefront_theme ?? null);
  }, [store?.storefront_theme]);

  // Restore dark (admin default) only when the entire storefront section unmounts
  // (i.e. user navigates to admin). Does NOT run between customer page navigations
  // because this provider stays mounted throughout the storefront session.
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
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
    if (!slug) { setLoading(false); return; }

    let cancelled = false;

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
    store,
    profile,
    storeId: store?.id ?? null,
    storeSlug: store?.slug ?? slug ?? null,
    loading,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// Returns safe defaults when called outside a StoreProvider (e.g. admin pages).
export function useStorefront(): StoreContextValue {
  const ctx = useContext(StoreContext);
  return ctx ?? { store: null, profile: null, storeId: null, storeSlug: null, loading: false };
}
