import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface AnimatedTextProps {
  text: string;
  className?: string;
  delay?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  gradient?: boolean;
}

export const AnimatedText = ({
  text,
  className = '',
  delay = 0,
  as: Component = 'span',
  gradient = false
}: AnimatedTextProps) => {
  const textRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!textRef.current) return;

    const words = text.split(' ');
    textRef.current.innerHTML = words
      .map((word) => {
        const chars = word.split('');
        return `<span class="word inline-block mr-2">${chars
          .map(
            (char) =>
              `<span class="char inline-block ${gradient ? 'gradient-char' : ''}">${char === ' ' ? '&nbsp;' : char}</span>`
          )
          .join('')}</span>`;
      })
      .join(' ');

    const chars = textRef.current.querySelectorAll('.char');

    // Character stagger animation
    gsap.fromTo(
      chars,
      {
        opacity: 0,
        y: 50,
        rotationX: -90,
      },
      {
        opacity: 1,
        y: 0,
        rotationX: 0,
        duration: 0.8,
        stagger: 0.02,
        ease: 'back.out(1.7)',
        delay: delay,
      }
    );

    // Gradient wave animation (if gradient prop is true)
    if (gradient) {
      gsap.to(chars, {
        backgroundPosition: '200% center',
        duration: 3,
        repeat: -1,
        ease: 'none',
        stagger: {
          each: 0.1,
          repeat: -1,
        },
      });
    }
  }, [text, delay, gradient]);

  return <Component ref={textRef as any} className={className} />;
};
