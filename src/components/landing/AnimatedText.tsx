import { useRef } from 'react';

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
  delay: _delay = 0,
  as: Component = 'span',
  gradient = false
}: AnimatedTextProps) => {
  const containerRef = useRef<HTMLElement>(null);
  const words = text.split(' ');

  // Words rendered as plain visible spans — no GSAP opacity:0 hiding.
  // This lets the prerendered hero text be LCP-eligible immediately at FCP time
  // instead of waiting 3-9 seconds for GSAP to execute.
  return (
    <Component ref={containerRef as any} className={className} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={i}
          className="word inline-block"
          style={{ marginRight: i < words.length - 1 ? '0.3em' : 0 }}
        >
          <span
            className={`word-inner inline-block${gradient ? ' bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient' : ''}`}
          >
            {word}
          </span>
        </span>
      ))}
    </Component>
  );
};
