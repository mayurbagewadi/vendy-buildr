import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface AnimateOnScrollProps {
  children: React.ReactNode;
  className?: string;
  animation?: 'fadeSlideUp' | 'fadeSlideDown' | 'fadeSlideLeft' | 'fadeSlideRight' | 'fadeIn' | 'scaleUp' | 'slideUp';
  duration?: number;
  delay?: number;
  distance?: number;
  triggerStart?: number;
  stagger?: number;
  customProps?: gsap.TweenVars;
}

/**
 * Enterprise-grade wrapper component for scroll animations
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

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;
    let fromVars: gsap.TweenVars = { opacity: 0 };

    switch (animation) {
      case 'fadeSlideUp':
        fromVars = { opacity: 0, y: distance };
        break;
      case 'fadeSlideDown':
        fromVars = { opacity: 0, y: -distance };
        break;
      case 'fadeSlideLeft':
        fromVars = { opacity: 0, x: distance };
        break;
      case 'fadeSlideRight':
        fromVars = { opacity: 0, x: -distance };
        break;
      case 'fadeIn':
        fromVars = { opacity: 0 };
        break;
      case 'scaleUp':
        fromVars = { opacity: 0, scale: 0.8 };
        break;
      case 'slideUp':
        fromVars = { y: distance };
        break;
    }

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

    return () => {
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.trigger === element) {
          trigger.kill();
        }
      });
    };
  }, [animation, duration, delay, distance, triggerStart, stagger, customProps]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
