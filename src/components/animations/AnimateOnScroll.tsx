import React from 'react';
import { useScrollAnimation, ScrollAnimationOptions } from '@/hooks/useScrollAnimation';

interface AnimateOnScrollProps extends ScrollAnimationOptions {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Enterprise-grade wrapper component for scroll animations
 * Makes it easy to add GSAP scroll animations to any element
 *
 * @example
 * <AnimateOnScroll animation="fadeSlideUp" duration={0.8}>
 *   <h1>Animated Heading</h1>
 * </AnimateOnScroll>
 *
 * @example with stagger
 * <AnimateOnScroll animation="slideUp" stagger={0.1}>
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 *   <div>Item 3</div>
 * </AnimateOnScroll>
 */
export function AnimateOnScroll({
  children,
  className = '',
  as: Component = 'div',
  animation = 'fadeSlideUp',
  duration = 0.8,
  delay = 0,
  distance = 40,
  triggerStart = 0.15,
  stagger = 0,
  customProps = {},
}: AnimateOnScrollProps) {
  const ref = useScrollAnimation({
    animation,
    duration,
    delay,
    distance,
    triggerStart,
    stagger,
    customProps,
  });

  return (
    <Component ref={ref} className={className}>
      {children}
    </Component>
  );
}
