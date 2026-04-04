import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export const FloatingParticles = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const particles = containerRef.current.querySelectorAll('.particle');

    particles.forEach((particle, index) => {
      // Random starting position - constrained within safe bounds
      const startX = Math.random() * (window.innerWidth - 4);
      const startY = Math.random() * (window.innerHeight - 4);

      gsap.set(particle, {
        x: startX,
        y: startY,
        scale: Math.random() * 0.5 + 0.5,
        opacity: Math.random() * 0.3 + 0.1
      });

      // Floating animation - limited drift to prevent overflow
      const driftX = Math.random() * 100 - 50;
      const driftY = Math.random() * 100 - 50;

      gsap.to(particle, {
        y: `+=${driftY}`,
        x: `+=${driftX}`,
        duration: Math.random() * 10 + 10,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: Math.random() * 2
      });

      // Rotation animation
      gsap.to(particle, {
        rotation: Math.random() * 360,
        duration: Math.random() * 20 + 10,
        repeat: -1,
        ease: 'none'
      });

      // Scale pulse
      gsap.to(particle, {
        scale: `+=${Math.random() * 0.3}`,
        duration: Math.random() * 3 + 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    });
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="particle absolute w-2 h-2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${
              i % 3 === 0
                ? 'rgba(59, 130, 246, 0.4)'
                : i % 3 === 1
                ? 'rgba(139, 92, 246, 0.4)'
                : 'rgba(236, 72, 153, 0.4)'
            }, transparent)`,
            filter: 'blur(1px)'
          }}
        />
      ))}
    </div>
  );
};
