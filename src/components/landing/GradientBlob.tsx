// Pure CSS blob — scale, rotation and drift run on the GPU compositor thread.
// Uses CSS individual transform properties (translate / rotate / scale) so all
// three animations compose without overwriting each other.
// Zero JavaScript, zero GSAP, zero main-thread animation cost.

interface GradientBlobProps {
  color: 'blue' | 'purple' | 'pink' | 'green';
  size?: 'sm' | 'md' | 'lg';
  position: { top?: string; bottom?: string; left?: string; right?: string };
}

export const GradientBlob = ({ color, size = 'md', position }: GradientBlobProps) => {
  const colors = {
    blue:   'from-blue-500/20 to-blue-600/10',
    purple: 'from-purple-500/20 to-purple-600/10',
    pink:   'from-pink-500/20 to-pink-600/10',
    green:  'from-green-500/20 to-green-600/10',
  };

  const sizes = {
    sm: 'w-32 h-32 sm:w-48 sm:h-48 lg:w-64 lg:h-64',
    md: 'w-48 h-48 sm:w-64 sm:h-64 lg:w-96 lg:h-96',
    lg: 'w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96',
  };

  return (
    <>
      {/* Keyframes injected once — namespaced to avoid collisions. */}
      <style>{`
        @keyframes dd-blob-pulse { 0%,100% { scale: 1;      } 50% { scale: 1.2;    } }
        @keyframes dd-blob-spin  { to      { rotate: 360deg; }                        }
        @keyframes dd-blob-drift { 0%,100% { translate: 0 0; } 50% { translate: 20px 15px; } }
      `}</style>
      <div
        className={`absolute ${sizes[size]} bg-gradient-to-br ${colors[color]} rounded-full blur-3xl opacity-30`}
        style={{
          ...position,
          animation: 'dd-blob-pulse 8s ease-in-out infinite, dd-blob-spin 20s linear infinite, dd-blob-drift 10s ease-in-out infinite',
          willChange: 'transform',
        }}
        aria-hidden="true"
      />
    </>
  );
};
