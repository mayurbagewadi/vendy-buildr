import { useEffect, useLayoutEffect, useRef } from 'react';

// Landing animations stay CSS/native: anchor smooth-scroll, IntersectionObserver
// reveals, and hover transforms. No per-scroll hero parallax work.
export const useLandingAnimations = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const sellersRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const hide = (selector: string, container: HTMLElement | null) => {
      container?.querySelectorAll<HTMLElement>(selector).forEach(el => {
        el.style.opacity = '0';
      });
    };
    hide('.feature-card', featuresRef.current);
    hide('.seller-card', sellersRef.current);
    hide('.step-card', stepsRef.current);
  }, []);

  useEffect(() => {
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

    const hoverStyle = document.createElement('style');
    hoverStyle.textContent = [
      '.seller-card{transition:box-shadow 0.3s ease,transform 0.3s ease}',
      '.seller-card:hover{transform:translateY(-8px)}',
      '.step-card{transition:opacity 0.7s ease,transform 0.7s ease}',
    ].join('');
    document.head.appendChild(hoverStyle);

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

    const sellerCards = sellersRef.current?.querySelectorAll<HTMLElement>('.seller-card') ?? [];
    const sellerObs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const index = Array.from(sellerCards).indexOf(el);
          el.style.transitionDelay = `${index * 0.08}s`;
          el.style.opacity = '1';
          el.style.transform = '';
          sellerObs.unobserve(el);
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );
    sellerCards.forEach(el => {
      el.style.transform = 'translateY(50px) scale(0.92)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease, box-shadow 0.3s ease';
      sellerObs.observe(el);
    });

    const stepCards = stepsRef.current?.querySelectorAll<HTMLElement>('.step-card') ?? [];
    const stepObs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const index = Array.from(stepCards).indexOf(el);
          el.style.transitionDelay = `${index * 0.12}s`;
          el.style.opacity = '1';
          el.style.transform = '';
          stepObs.unobserve(el);
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    stepCards.forEach(el => {
      el.style.transform = 'translateX(-40px) scale(0.95)';
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
      stepObs.observe(el);
    });

    return () => {
      anchors.forEach(a => a.removeEventListener('click', handleSmoothScroll));
      hoverStyle.remove();
      featureObs.disconnect();
      sellerObs.disconnect();
      stepObs.disconnect();
    };
  }, []);

  return { heroRef, featuresRef, stepsRef, sellersRef };
};
