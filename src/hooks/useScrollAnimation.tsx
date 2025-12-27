import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

export interface ScrollAnimationOptions {
  /** Animation type */
  animation?: 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale' | 'fadeSlideUp';
  /** Animation duration in seconds */
  duration?: number;
  /** Delay before animation starts */
  delay?: number;
  /** Distance to move for slide animations (in pixels) */
  distance?: number;
  /** Percentage of element visible before trigger (0-1) */
  triggerStart?: number;
  /** Enable stagger for multiple elements */
  stagger?: number;
  /** Custom GSAP animation properties */
  customProps?: gsap.TweenVars;
}

/**
 * Enterprise-grade GSAP scroll animation hook
 * Provides reusable scroll-triggered animations with performance optimization
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

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Check for reduced motion preference (accessibility)
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      // Skip animations for users who prefer reduced motion
      gsap.set(element, { opacity: 1, x: 0, y: 0, scale: 1 });
      if (element.children.length > 0) {
        gsap.set(Array.from(element.children), { opacity: 1, x: 0, y: 0, scale: 1 });
      }
      return;
    }

    // Define animation presets
    const animations: Record<string, { from: gsap.TweenVars; to: gsap.TweenVars }> = {
      fadeIn: {
        from: { opacity: 0 },
        to: { opacity: 1, duration, delay },
      },
      slideUp: {
        from: { opacity: 0, y: distance },
        to: { opacity: 1, y: 0, duration, delay, ease: 'power2.out' },
      },
      slideDown: {
        from: { opacity: 0, y: -distance },
        to: { opacity: 1, y: 0, duration, delay, ease: 'power2.out' },
      },
      slideLeft: {
        from: { opacity: 0, x: distance },
        to: { opacity: 1, x: 0, duration, delay, ease: 'power2.out' },
      },
      slideRight: {
        from: { opacity: 0, x: -distance },
        to: { opacity: 1, x: 0, duration, delay, ease: 'power2.out' },
      },
      scale: {
        from: { opacity: 0, scale: 0.8 },
        to: { opacity: 1, scale: 1, duration, delay, ease: 'back.out(1.2)' },
      },
      fadeSlideUp: {
        from: { opacity: 0, y: distance },
        to: { opacity: 1, y: 0, duration, delay, ease: 'power2.out' },
      },
    };

    const selectedAnimation = animations[animation] || animations.fadeSlideUp;

    // Determine animation targets
    const hasStagger = stagger > 0 && element.children.length > 0;
    const targets = hasStagger ? Array.from(element.children) : element;

    // Set initial state on targets
    gsap.set(targets, selectedAnimation.from);

    // Create scroll-triggered animation
    const ctx = gsap.context(() => {
      // Check if element is already in viewport on mount
      const rect = element.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight * 0.9; // Trigger if within 90% of viewport

      if (isInViewport) {
        // Element already visible - animate immediately
        gsap.to(targets, {
          ...selectedAnimation.to,
          stagger: hasStagger ? stagger : 0,
          ...customProps,
        });
      } else {
        // Element below fold - wait for scroll
        // Trigger when element top reaches 85% down the viewport (more forgiving)
        ScrollTrigger.create({
          trigger: element,
          start: 'top 90%', // Animate when element is 85% down the screen
          once: true,
          onEnter: () => {
            gsap.to(targets, {
              ...selectedAnimation.to,
              stagger: hasStagger ? stagger : 0,
              ...customProps,
            });
          },
        });
      }
    });

    // Cleanup
    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.trigger === element) {
          trigger.kill();
        }
      });
    };
  }, [animation, duration, delay, distance, triggerStart, stagger, customProps]);

  return elementRef;
}

/**
 * Batch animation hook for multiple elements with stagger
 * Useful for product grids, category lists, etc.
 *
 * @example
 * const ref = useScrollAnimationBatch({ stagger: 0.1 });
 * return (
 *   <div ref={ref}>
 *     <div>Item 1</div>
 *     <div>Item 2</div>
 *     <div>Item 3</div>
 *   </div>
 * );
 */
export function useScrollAnimationBatch<T extends HTMLElement = HTMLDivElement>(
  options: ScrollAnimationOptions = {}
) {
  return useScrollAnimation<T>({
    ...options,
    stagger: options.stagger || 0.1,
  });
}
