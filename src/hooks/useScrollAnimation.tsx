import { useEffect, useLayoutEffect, useRef } from 'react';

// TweenVars without the GSAP import — prevents GSAP from entering the main bundle.
type TweenVars = Record<string, unknown>;

export interface ScrollAnimationOptions {
  animation?: 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale' | 'fadeSlideUp';
  duration?: number;
  delay?: number;
  distance?: number;
  triggerStart?: number;
  stagger?: number;
  customProps?: TweenVars;
}

/**
 * Enterprise-grade GSAP scroll animation hook.
 * GSAP is loaded via dynamic import after the page load event so it never
 * blocks FCP/LCP on the landing page or any other entry point.
 *
 * @example
 * const ref = useScrollAnimation({ animation: 'fadeSlideUp', duration: 0.8 });
 * return <div ref={ref}>Animated content</div>
 */
export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  options: ScrollAnimationOptions = {}
) {
  const elementRef = useRef<T>(null);

  const {
    animation = 'fadeSlideUp',
    duration = 0.8,
    delay = 0,
    distance = 40,
    triggerStart = 0.15,
    stagger = 0,
    customProps = {},
  } = options;

  // Set initial hidden state synchronously before first browser paint — no flash.
  useLayoutEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    if (animation !== 'slideUp') {
      el.style.opacity = '0';
    }
  }, [animation]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const animationDefs: Record<string, { from: TweenVars; to: TweenVars }> = {
      fadeIn:      { from: { opacity: 0 },                      to: { opacity: 1, duration, delay } },
      slideUp:     { from: { opacity: 0, y: distance },         to: { opacity: 1, y: 0, duration, delay, ease: 'power2.out' } },
      slideDown:   { from: { opacity: 0, y: -distance },        to: { opacity: 1, y: 0, duration, delay, ease: 'power2.out' } },
      slideLeft:   { from: { opacity: 0, x: distance },         to: { opacity: 1, x: 0, duration, delay, ease: 'power2.out' } },
      slideRight:  { from: { opacity: 0, x: -distance },        to: { opacity: 1, x: 0, duration, delay, ease: 'power2.out' } },
      scale:       { from: { opacity: 0, scale: 0.8 },          to: { opacity: 1, scale: 1, duration, delay, ease: 'back.out(1.2)' } },
      fadeSlideUp: { from: { opacity: 0, y: distance },         to: { opacity: 1, y: 0, duration, delay, ease: 'power2.out' } },
    };

    const selectedAnimation = animationDefs[animation] || animationDefs.fadeSlideUp;
    const hasStagger = stagger > 0 && element.children.length > 0;
    const targets = hasStagger ? Array.from(element.children) : element;

    const initAnimation = async () => {
      // Check for reduced motion preference (accessibility)
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        element.style.opacity = '';
        return;
      }

      const { default: gsap }  = await import('gsap');
      const { ScrollTrigger }  = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      // Remove the inline opacity set by useLayoutEffect so GSAP owns the value
      element.style.opacity = '';

      gsap.set(targets, selectedAnimation.from);

      const ctx = gsap.context(() => {
        const rect = element.getBoundingClientRect();
        const isInViewport = rect.top < window.innerHeight * 0.9;

        if (isInViewport) {
          gsap.to(targets, { ...selectedAnimation.to, stagger: hasStagger ? stagger : 0, ...customProps });
        } else {
          ScrollTrigger.create({
            trigger: element,
            start: 'top 90%',
            once: true,
            onEnter: () => {
              gsap.to(targets, { ...selectedAnimation.to, stagger: hasStagger ? stagger : 0, ...customProps });
            },
          });
        }
      });

      return () => {
        ctx.revert();
        ScrollTrigger.getAll().forEach(trigger => {
          if (trigger.trigger === element) trigger.kill();
        });
      };
    };

    let asyncCleanup: (() => void) | undefined;

    const run = () => {
      initAnimation().then(cleanup => { asyncCleanup = cleanup; });
    };

    if (document.readyState === 'complete') {
      run();
    } else {
      window.addEventListener('load', run, { once: true });
    }

    return () => {
      if (asyncCleanup) asyncCleanup();
    };
  }, [animation, duration, delay, distance, triggerStart, stagger, customProps]);

  return elementRef;
}

/**
 * Batch animation hook for multiple elements with stagger.
 *
 * @example
 * const ref = useScrollAnimationBatch({ stagger: 0.1 });
 * return (
 *   <div ref={ref}>
 *     <div>Item 1</div>
 *     <div>Item 2</div>
 *   </div>
 * );
 */
export function useScrollAnimationBatch<T extends HTMLElement = HTMLDivElement>(
  options: ScrollAnimationOptions = {}
) {
  return useScrollAnimation<T>({ ...options, stagger: options.stagger || 0.1 });
}
