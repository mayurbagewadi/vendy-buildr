import { useEffect, useLayoutEffect, useRef } from 'react';

// Zero-GSAP landing animations.
//
// Strategy:
//   • Hero parallax    → passive scroll listener  (no layout reads, pure transform write)
//   • Section reveals  → IntersectionObserver     (native browser API, background thread)
//   • Seller/step hover→ injected CSS rule        (GPU compositor, no JS per-frame cost)
//   • Smooth scroll    → native scrollTo          (unchanged)
//
// Result: GSAP core (27 KB gzip) + ScrollTrigger (18 KB gzip) removed from critical path entirely.

export const useLandingAnimations = () => {
  const heroRef     = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const stepsRef    = useRef<HTMLDivElement>(null);
  const sellersRef  = useRef<HTMLDivElement>(null);

  // ─── Set initial hidden state BEFORE first browser paint (no flash) ───────────
  useLayoutEffect(() => {
    const hide = (selector: string, container: HTMLElement | null) => {
      container?.querySelectorAll<HTMLElement>(selector).forEach(el => {
        el.style.opacity = '0';
      });
    };
    hide('.feature-card', featuresRef.current);
    hide('.seller-card',  sellersRef.current);
    hide('.step-card',    stepsRef.current);
  }, []);

  useEffect(() => {
    // ── 1. Smooth scroll for in-page anchor links ─────────────────────────────
    const handleSmoothScroll = (e: Event) => {
      e.preventDefault();
      const href = (e.currentTarget as HTMLAnchorElement).getAttribute('href');
      if (href?.startsWith('#')) {
        const el = document.querySelector(href);
        if (el) {
          const top = el.getBoundingClientRect().top + window.pageYOffset - 80;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }
    };
    const anchors = document.querySelectorAll('a[href^="#"]');
    anchors.forEach(a => a.addEventListener('click', handleSmoothScroll));

    // ── 2. Hover styles — CSS injection (no per-frame JS) ────────────────────
    // seller-card: Tailwind only adds shadow on hover; we add the translate.
    // feature-card: already has hover:-translate-y-2 in Tailwind — no action needed.
    const hoverStyle = document.createElement('style');
    hoverStyle.textContent = [
      '.seller-card{transition:box-shadow 0.3s ease,transform 0.3s ease}',
      '.seller-card:hover{transform:translateY(-8px)}',
      '.step-card{transition:opacity 0.7s ease,transform 0.7s ease}',
    ].join('');
    document.head.appendChild(hoverStyle);

    // ── 3. Hero parallax — passive scroll listener ────────────────────────────
    const heroEl = heroRef.current;
    let ticking   = false;
    const onScroll = () => {
      if (!heroEl || ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const sy = window.scrollY;
        heroEl.querySelectorAll<HTMLElement>('.hero-decorative').forEach((el, i) => {
          const rate = i % 2 === 0 ? 0.25 : -0.25;
          el.style.transform = `translateY(${sy * rate}px)`;
        });
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // ── 4. IntersectionObserver — section scroll reveals ──────────────────────

    // Feature cards — fade + rise (Tailwind transition-all duration-700 already present)
    const featureCards = featuresRef.current?.querySelectorAll<HTMLElement>('.feature-card') ?? [];
    const featureObs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          el.style.opacity = '1';
          el.style.transform = '';
          featureObs.unobserve(el);
        });
      },
      { threshold: 0.1 }
    );
    featureCards.forEach(el => {
      el.style.transform = 'translateY(50px) scale(0.92)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      featureObs.observe(el);
    });

    // Seller cards — staggered fade + rise
    const sellerCards = sellersRef.current?.querySelectorAll<HTMLElement>('.seller-card') ?? [];
    const sellerObs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el    = entry.target as HTMLElement;
          const index = Array.from(sellerCards).indexOf(el);
          el.style.transitionDelay = `${index * 0.08}s`;
          el.style.opacity   = '1';
          el.style.transform = '';
          sellerObs.unobserve(el);
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );
    sellerCards.forEach(el => {
      el.style.transform  = 'translateY(50px) scale(0.92)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease, box-shadow 0.3s ease';
      sellerObs.observe(el);
    });

    // Step cards — staggered fade + slide from left
    const stepCards = stepsRef.current?.querySelectorAll<HTMLElement>('.step-card') ?? [];
    const stepObs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el    = entry.target as HTMLElement;
          const index = Array.from(stepCards).indexOf(el);
          el.style.transitionDelay = `${index * 0.12}s`;
          el.style.opacity   = '1';
          el.style.transform = '';
          stepObs.unobserve(el);
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    stepCards.forEach(el => {
      el.style.transform  = 'translateX(-40px) scale(0.95)';
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
      stepObs.observe(el);
    });

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      anchors.forEach(a => a.removeEventListener('click', handleSmoothScroll));
      window.removeEventListener('scroll', onScroll);
      hoverStyle.remove();
      featureObs.disconnect();
      sellerObs.disconnect();
      stepObs.disconnect();
    };
  }, []);

  return { heroRef, featuresRef, stepsRef, sellersRef };
};
