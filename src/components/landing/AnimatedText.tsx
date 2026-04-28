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
  const containerRef = useRef<HTMLElement>(null);
  const words = text.split(' ');

  useEffect(() => {
    if (!containerRef.current) return;

    const wordInners = containerRef.current.querySelectorAll('.word-inner');

    // Premium word-reveal: each word slides up from below its clip boundary
    gsap.fromTo(
      wordInners,
      {
        y: '110%',
        opacity: 0,
        rotationX: -40,
      },
      {
        y: '0%',
        opacity: 1,
        rotationX: 0,
        duration: 0.75,
        stagger: 0.12,
        ease: 'back.out(1.4)',
        delay: delay,
      }
    );
  }, [text, delay]);

  return (
    <Component ref={containerRef as any} className={className} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={i}
          className="word inline-block overflow-hidden"
          style={{ marginRight: i < words.length - 1 ? '0.3em' : 0 }}
        >
          <span
            className={`word-inner inline-block${gradient ? ' bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient' : ''}`}
            style={{ opacity: 0, transform: 'translateY(110%) rotateX(-40deg)' }}
          >
            {word}
          </span>
        </span>
      ))}
    </Component>
  );
};
