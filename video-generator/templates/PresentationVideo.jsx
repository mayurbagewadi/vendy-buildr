import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

/**
 * Animated Presentation Template
 * Feature showcase with animated elements
 */
export const PresentationVideo = ({ title, script }) => {
  const frame = useCurrentFrame();

  // Animated background circles
  const circle1X = interpolate(frame, [0, 300], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const circle2X = interpolate(frame, [0, 300], [-200, -100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Title animation
  const titleScale = interpolate(frame, [0, 45], [0.6, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const titleOpacity = interpolate(frame, [0, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Content animation
  const contentOpacity = interpolate(frame, [90, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const contentY = interpolate(frame, [90, 120], [100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Feature boxes animation
  const featureScale = interpolate(frame, [180, 240], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0e27', color: 'white', fontFamily: 'Arial, sans-serif', overflow: 'hidden' }}>
      {/* Animated background gradient */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1a3e 50%, #0a0e27 100%)',
        zIndex: 0
      }} />

      {/* Animated circles - background elements */}
      <div style={{
        position: 'absolute',
        top: '-200px',
        left: `${circle1X}%`,
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 212, 255, 0.1) 0%, transparent 70%)',
        filter: 'blur(40px)',
        zIndex: 1
      }} />

      <div style={{
        position: 'absolute',
        bottom: '-150px',
        right: `${circle2X}%`,
        width: '350px',
        height: '350px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(100, 200, 255, 0.1) 0%, transparent 70%)',
        filter: 'blur(40px)',
        zIndex: 1
      }} />

      {/* Title */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${titleScale})`,
        opacity: titleOpacity,
        textAlign: 'center',
        width: '90%',
        zIndex: 2
      }}>
        <h1 style={{
          fontSize: '72px',
          margin: 0,
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '2px'
        }}>
          {title}
        </h1>
      </div>

      {/* Main content */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) translateY(${contentY}px)`,
        opacity: contentOpacity,
        textAlign: 'center',
        width: '90%',
        zIndex: 2
      }}>
        <p style={{
          fontSize: '36px',
          color: '#e0e0e0',
          lineHeight: '1.8',
          margin: 0,
          fontWeight: '500'
        }}>
          {script}
        </p>
      </div>

      {/* Feature highlights */}
      <div style={{
        position: 'absolute',
        bottom: '100px',
        left: '50%',
        transform: `translateX(-50%) scale(${featureScale})`,
        opacity: featureScale,
        display: 'flex',
        gap: '30px',
        width: '90%',
        maxWidth: '1200px',
        zIndex: 2
      }}>
        {['Fast', 'Secure', 'Scalable'].map((feature, idx) => (
          <div
            key={feature}
            style={{
              flex: 1,
              padding: '20px',
              borderRadius: '12px',
              border: '2px solid #0099cc',
              background: 'rgba(0, 212, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              textAlign: 'center'
            }}
          >
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#00d4ff',
              marginBottom: '10px'
            }}>
              {feature}
            </div>
            <div style={{
              fontSize: '14px',
              color: '#aaa'
            }}>
              Industry-leading {feature.toLowerCase()} performance
            </div>
          </div>
        ))}
      </div>

      {/* Logo */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '40px',
        fontSize: '18px',
        color: '#0099cc',
        fontWeight: 'bold',
        zIndex: 3
      }}>
        Vendy-Buildr
      </div>
    </AbsoluteFill>
  );
};
