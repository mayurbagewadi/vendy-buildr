import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

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
    sm: 'w-64 h-64',
    md: 'w-96 h-96',
    lg: 'w-[600px] h-[600px]',
  };

  useEffect(() => {
    if (!blobRef.current) return;

    // Morphing animation
    gsap.to(blobRef.current, {
      scale: 1.2,
      duration: 8,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    // Rotation
    gsap.to(blobRef.current, {
      rotation: 360,
      duration: 20,
      repeat: -1,
      ease: 'none',
    });

    // Position drift
    gsap.to(blobRef.current, {
      x: '+=50',
      y: '+=30',
      duration: 10,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }, []);

  return (
    <div
      ref={blobRef}
      className={`absolute ${sizes[size]} bg-gradient-to-br ${colors[color]} rounded-full blur-3xl opacity-30`}
      style={position}
    />
  );
};
