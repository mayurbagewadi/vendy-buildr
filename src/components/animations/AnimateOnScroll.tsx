import React, { useRef, useEffect, useLayoutEffect } from 'react';

// TweenVars without the GSAP import — prevents GSAP from entering the main bundle.
type TweenVars = Record<string, unknown>;

interface AnimateOnScrollProps {
  children: React.ReactNode;
  className?: string;
  animation?: 'fadeSlideUp' | 'fadeSlideDown' | 'fadeSlideLeft' | 'fadeSlideRight' | 'fadeIn' | 'scaleUp' | 'slideUp';
  duration?: number;
  delay?: number;
  distance?: number;
  triggerStart?: number;
  stagger?: number;
  customProps?: TweenVars;
}

/**
 * Enterprise-grade wrapper component for scroll animations.
 * GSAP is loaded via dynamic import after the page load event so it never
 * blocks FCP/LCP on the landing page or any other entry point.
 */
export function AnimateOnScroll({
  children,
  className = '',
  animation = 'fadeSlideUp',
  duration = 0.8,
  delay = 0,
  distance = 40,
  triggerStart = 0.15,
  stagger = 0,
  customProps = {},
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Set initial hidden state synchronously before first browser paint — no flash.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    switch (animation) {
      case 'fadeSlideUp':
      case 'fadeSlideDown':
      case 'fadeSlideLeft':
      case 'fadeSlideRight':
      case 'fadeIn':
      case 'scaleUp':
        el.style.opacity = '0';
        break;
      // slideUp keeps opacity — only translates
    }
  }, [animation]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let fromVars: TweenVars = { opacity: 0 };
    switch (animation) {
      case 'fadeSlideUp':    fromVars = { opacity: 0, y: distance };   break;
      case 'fadeSlideDown':  fromVars = { opacity: 0, y: -distance };  break;
      case 'fadeSlideLeft':  fromVars = { opacity: 0, x: distance };   break;
      case 'fadeSlideRight': fromVars = { opacity: 0, x: -distance };  break;
      case 'fadeIn':         fromVars = { opacity: 0 };                break;
      case 'scaleUp':        fromVars = { opacity: 0, scale: 0.8 };   break;
      case 'slideUp':        fromVars = { y: distance };               break;
    }

    const initAnimation = async () => {
      const { default: gsap }  = await import('gsap');
      const { ScrollTrigger }  = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      // Remove the inline opacity set by useLayoutEffect so GSAP owns the value
      element.style.opacity = '';

      gsap.set(element, fromVars);

      gsap.to(element, {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        duration,
        delay,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: element,
          start: `top ${100 - triggerStart * 100}%`,
          toggleActions: 'play none none none',
        },
        stagger: stagger > 0 ? stagger : undefined,
        ...customProps,
      });
    };

    if (document.readyState === 'complete') {
      initAnimation();
    } else {
      window.addEventListener('load', initAnimation, { once: true });
    }

    return () => {
      // Async cleanup: ScrollTrigger kills itself when the element is removed
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        ScrollTrigger.getAll().forEach(trigger => {
          if (trigger.trigger === element) trigger.kill();
        });
      });
    };
  }, [animation, duration, delay, distance, triggerStart, stagger, customProps]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
