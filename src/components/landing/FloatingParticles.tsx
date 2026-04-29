import React from 'react';

// Fixed particle configs — deterministic positions + varied drift directions.
// Runs entirely on the CSS compositor thread. Zero JS animation, zero GSAP, zero main-thread cost.
const PARTICLES: Array<{
  x: string; y: string;
  dx: number; dy: number;
  duration: number; delay: number;
  color: string;
}> = [
  { x: '15%', y: '20%', dx:  60, dy:  40, duration: 18, delay: 0.0, color: 'rgba(59,130,246,0.4)'  },
  { x: '75%', y: '10%', dx: -50, dy:  60, duration: 22, delay: 1.5, color: 'rgba(139,92,246,0.4)'  },
  { x: '85%', y: '60%', dx: -40, dy: -50, duration: 16, delay: 3.0, color: 'rgba(236,72,153,0.4)'  },
  { x: '20%', y: '80%', dx:  70, dy: -30, duration: 20, delay: 2.0, color: 'rgba(59,130,246,0.4)'  },
  { x: '50%', y: '50%', dx: -60, dy:  40, duration: 24, delay: 4.0, color: 'rgba(139,92,246,0.4)'  },
  { x: '40%', y: '15%', dx:  30, dy:  70, duration: 19, delay: 0.5, color: 'rgba(236,72,153,0.4)'  },
  { x: '90%', y: '30%', dx: -70, dy: -40, duration: 21, delay: 2.5, color: 'rgba(59,130,246,0.4)'  },
  { x: '10%', y: '60%', dx:  50, dy: -60, duration: 17, delay: 1.0, color: 'rgba(139,92,246,0.4)'  },
];

export const FloatingParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <style>{`
      @keyframes dd-particle-float {
        0%, 100% { transform: translate(0, 0) scale(1);   opacity: 0.2; }
        50%       { transform: translate(var(--pdx), var(--pdy)) scale(1.3); opacity: 0.4; }
      }
    `}</style>
    {PARTICLES.map((p, i) => (
      <div
        key={i}
        className="absolute w-2 h-2 rounded-full"
        style={{
          left: p.x,
          top:  p.y,
          '--pdx': `${p.dx}px`,
          '--pdy': `${p.dy}px`,
          background: `radial-gradient(circle, ${p.color}, transparent)`,
          filter: 'blur(1px)',
          animation: `dd-particle-float ${p.duration}s ease-in-out ${p.delay}s infinite`,
        } as React.CSSProperties}
      />
    ))}
  </div>
);
