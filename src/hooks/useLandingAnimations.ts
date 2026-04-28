import { useEffect, useRef } from 'react';

// GSAP is loaded via dynamic import after the load event fires.
// This keeps GSAP entirely out of the main bundle and ensures it never
// competes with LCP/FCP. Hero text reveal animations are intentionally
// removed — hero text is now visible in prerendered HTML (good for LCP).

export const useLandingAnimations = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const sellersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Smooth scroll for navigation links (no GSAP needed)
    const handleSmoothScroll = (e: Event) => {
      e.preventDefault();
      const target = e.currentTarget as HTMLAnchorElement;
      const targetId = target.getAttribute('href');

      if (targetId && targetId.startsWith('#')) {
        const element = document.querySelector(targetId);
        if (element) {
          const offsetTop = element.getBoundingClientRect().top + window.pageYOffset - 80;
          window.scrollTo({ top: offsetTop, behavior: 'smooth' });
        }
      }
    };

    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => link.addEventListener('click', handleSmoothScroll));

    // Capture refs for use inside async closure (refs may change before async resolves)
    const heroEl      = heroRef.current;
    const featuresEl  = featuresRef.current;
    const sellersEl   = sellersRef.current;
    const stepsEl     = stepsRef.current;

    let killTriggers: (() => void) | null = null;

    const initAnimations = async () => {
      const { gsap }         = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      // Hero — decorative parallax only (NO text reveal: text is visible in SSG HTML)
      if (heroEl) {
        const decorative = heroEl.querySelectorAll('.hero-decorative');
        decorative.forEach((el, index) => {
          gsap.to(el, {
            yPercent: index % 2 === 0 ? 30 : -30,
            scrollTrigger: {
              trigger: heroEl,
              start: 'top top',
              end: 'bottom top',
              scrub: 1,
            }
          });
        });
      }

      // Features — scroll-triggered card entrance
      if (featuresEl) {
        const featureCards = featuresEl.querySelectorAll('.feature-card');

        featureCards.forEach((card) => {
          gsap.fromTo(card,
            { opacity: 0, y: 60, scale: 0.9 },
            {
              opacity: 1, y: 0, scale: 1,
              duration: 0.3,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: card,
                start: 'top bottom',
                end: 'bottom 20%',
                toggleActions: 'play none none reverse',
              },
            }
          );

          card.addEventListener('mouseenter', () => gsap.to(card, { y: -10, duration: 0.3, ease: 'power2.out' }));
          card.addEventListener('mouseleave', () => gsap.to(card, { y: 0,   duration: 0.3, ease: 'power2.out' }));
        });
      }

      // Sellers — staggered scroll-triggered entrance
      if (sellersEl) {
        const sellerCards = sellersEl.querySelectorAll('.seller-card');

        gsap.fromTo(sellerCards,
          { opacity: 0, y: 50, scale: 0.92 },
          {
            opacity: 1, y: 0, scale: 1,
            duration: 0.6,
            ease: 'power3.out',
            stagger: 0.1,
            scrollTrigger: {
              trigger: sellersEl,
              start: 'top 75%',
              end: 'bottom 20%',
              toggleActions: 'play none none reverse',
            }
          }
        );

        sellerCards.forEach((card) => {
          card.addEventListener('mouseenter', () => gsap.to(card, { y: -8, duration: 0.3, ease: 'power2.out' }));
          card.addEventListener('mouseleave', () => gsap.to(card, { y: 0,  duration: 0.3, ease: 'power2.out' }));
        });
      }

      // Steps — sequential reveal
      if (stepsEl) {
        const stepCards = stepsEl.querySelectorAll('.step-card');

        gsap.fromTo(stepCards,
          { opacity: 0, x: -50, scale: 0.95 },
          {
            opacity: 1, x: 0, scale: 1,
            duration: 0.8,
            ease: 'power3.out',
            stagger: 0.15,
            scrollTrigger: {
              trigger: stepsEl,
              start: 'top 70%',
              end: 'bottom 20%',
              toggleActions: 'play none none reverse',
            }
          }
        );
      }

      killTriggers = () => ScrollTrigger.getAll().forEach(t => t.kill());
    };

    // Fire GSAP only after the page load event — never blocks LCP/FCP
    if (document.readyState === 'complete') {
      initAnimations();
    } else {
      window.addEventListener('load', initAnimations, { once: true });
    }

    return () => {
      anchorLinks.forEach(link => link.removeEventListener('click', handleSmoothScroll));
      if (killTriggers) killTriggers();
    };
  }, []);

  return { heroRef, featuresRef, stepsRef, sellersRef };
};
