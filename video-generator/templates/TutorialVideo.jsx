import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill, Sequence } from 'remotion';

/**
 * Tutorial Video Template
 * How-to guides with step-by-step animations
 */
export const TutorialVideo = ({ title, script }) => {
  const frame = useCurrentFrame();

  // Animation values
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const titleScale = interpolate(frame, [0, 30], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const contentOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const contentY = interpolate(frame, [60, 90], [50, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a2e', color: 'white', fontFamily: 'Arial, sans-serif' }}>
      {/* Background with gradient */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        zIndex: 0
      }} />

      {/* Top accent bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: 'linear-gradient(90deg, #00d4ff 0%, #0099cc 100%)',
        zIndex: 1
      }} />

      {/* Title Section */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '50%',
        transform: `translate(-50%, 0) scale(${titleScale})`,
        opacity: titleOpacity,
        textAlign: 'center',
        width: '80%',
        zIndex: 2
      }}>
        <h1 style={{
          fontSize: '64px',
          margin: 0,
          fontWeight: 'bold',
          color: '#00d4ff',
          textShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
          letterSpacing: '2px'
        }}>
          {title}
        </h1>
        <div style={{
          height: '4px',
          width: '100px',
          background: '#0099cc',
          margin: '20px auto'
        }} />
      </div>

      {/* Content Section */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) translateY(${contentY}px)`,
        opacity: contentOpacity,
        textAlign: 'center',
        width: '85%',
        zIndex: 2
      }}>
        <p style={{
          fontSize: '32px',
          color: '#ffffff',
          lineHeight: '1.6',
          margin: 0
        }}>
          {script}
        </p>
      </div>

      {/* Bottom branding */}
      <div style={{
        position: 'absolute',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: interpolate(frame, [150, 180], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp'
        }),
        textAlign: 'center',
        zIndex: 2
      }}>
        <p style={{
          fontSize: '24px',
          color: '#0099cc',
          margin: '10px 0',
          fontWeight: 'bold'
        }}>
          Vendy-Buildr
        </p>
        <p style={{
          fontSize: '16px',
          color: '#888',
          margin: '5px 0'
        }}>
          The Multi-Tenant E-Commerce Platform
        </p>
      </div>

      {/* Step indicators */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '12px',
        zIndex: 2
      }}>
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: frame > step * 50 ? '#00d4ff' : '#444',
              transition: 'background 0.3s'
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
