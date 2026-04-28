import { useEffect, useRef } from 'react';

interface GradientBlobProps {
  color: 'blue' | 'purple' | 'pink' | 'green';
  size?: 'sm' | 'md' | 'lg';
  position: { top?: string; bottom?: string; left?: string; right?: string };
}

export const GradientBlob = ({ color, size = 'md', position }: GradientBlobProps) => {
  const blobRef = useRef<HTMLDivElement>(null);

  const colors = {
    blue: 'from-blue-500/20 to-blue-600/10',
    purple: 'from-purple-500/20 to-purple-600/10',
    pink: 'from-pink-500/20 to-pink-600/10',
    green: 'from-green-500/20 to-green-600/10',
  };

  const sizes = {
    sm: 'w-32 h-32 sm:w-48 sm:h-48 lg:w-64 lg:h-64',
    md: 'w-48 h-48 sm:w-64 sm:h-64 lg:w-96 lg:h-96',
    lg: 'w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96',
  };

  useEffect(() => {
    if (!blobRef.current) return;

    const el = blobRef.current;

    // Dynamic import keeps GSAP out of the main bundle.
    // Decorative blob animations are deferred until the browser is idle.
    const init = async () => {
      const { gsap } = await import('gsap');
      gsap.to(el, { scale: 1.2, duration: 8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to(el, { rotation: 360, duration: 20, repeat: -1, ease: 'none' });
      gsap.to(el, { x: '+=20', y: '+=15', duration: 10, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    };

    let idleId: number;
    if ('requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(init, { timeout: 3000 });
    } else {
      idleId = setTimeout(init, 1000) as unknown as number;
    }

    return () => {
      if ('cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId);
      }
    };
  }, []);

  return (
    <div
      ref={blobRef}
      className={`absolute ${sizes[size]} bg-gradient-to-br ${colors[color]} rounded-full blur-3xl opacity-30`}
      style={position}
    />
  );
};
