import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

/**
 * Product Demo Video Template
 * Live demonstration with interactive elements
 */
export const DemoVideo = ({ title, script }) => {
  const frame = useCurrentFrame();

  // Header animation
  const headerY = interpolate(frame, [0, 30], [-100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const headerOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Demo content animation
  const demoOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const demoScale = interpolate(frame, [60, 90], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Stats animation
  const statsOpacity = interpolate(frame, [150, 180], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Progress bar animation
  const progressWidth = interpolate(frame, [180, 270], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#ffffff', color: '#1a1a2e', fontFamily: 'Arial, sans-serif' }}>
      {/* Background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #f5f7fa 0%, #e8f0f7 100%)',
        zIndex: 0
      }} />

      {/* Header section */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '120px',
        background: 'linear-gradient(90deg, #1a1a2e 0%, #2a2a4e 100%)',
        transform: `translateY(${headerY}px)`,
        opacity: headerOpacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 50px',
        zIndex: 2
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '32px',
            color: '#00d4ff',
            fontWeight: 'bold'
          }}>
            Vendy-Buildr
          </h1>
          <p style={{
            margin: '5px 0 0 0',
            fontSize: '14px',
            color: '#0099cc'
          }}>
            Demo Experience
          </p>
        </div>
        <div style={{
          fontSize: '24px',
          color: '#0099cc',
          fontWeight: 'bold'
        }}>
          LIVE DEMO
        </div>
      </div>

      {/* Main demo area */}
      <div style={{
        position: 'absolute',
        top: '160px',
        left: '50%',
        transform: `translate(-50%, 0) scale(${demoScale})`,
        opacity: demoOpacity,
        width: '85%',
        maxWidth: '1200px',
        height: '500px',
        zIndex: 2
      }}>
        {/* Demo frame mockup */}
        <div style={{
          width: '100%',
          height: '100%',
          borderRadius: '16px',
          border: '3px solid #1a1a2e',
          background: '#ffffff',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Browser-like header */}
          <div style={{
            background: '#f0f0f0',
            padding: '12px 16px',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f' }} />
            <div style={{ flex: 1, marginLeft: '12px', fontSize: '12px', color: '#666' }}>
              yesgive.shop
            </div>
          </div>

          {/* Content area */}
          <div style={{
            flex: 1,
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#1a1a2e'
          }}>
            <div style={{
              fontSize: '28px',
              fontWeight: 'bold',
              marginBottom: '20px',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #0099cc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {title}
            </div>
            <p style={{
              fontSize: '18px',
              textAlign: 'center',
              color: '#555',
              lineHeight: '1.6'
            }}>
              {script}
            </p>
          </div>
        </div>
      </div>

      {/* Stats section */}
      <div style={{
        position: 'absolute',
        bottom: '120px',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: statsOpacity,
        display: 'flex',
        gap: '40px',
        width: '90%',
        justifyContent: 'center',
        zIndex: 2
      }}>
        {[
          { number: '1000+', label: 'Active Stores' },
          { number: '50K+', label: 'Products' },
          { number: '99.9%', label: 'Uptime' }
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '36px',
              fontWeight: 'bold',
              color: '#0099cc',
              marginBottom: '8px'
            }}>
              {stat.number}
            </div>
            <div style={{
              fontSize: '14px',
              color: '#666'
            }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '85%',
        maxWidth: '1200px',
        height: '6px',
        background: '#e0e0e0',
        borderRadius: '3px',
        overflow: 'hidden',
        zIndex: 2
      }}>
        <div style={{
          width: `${progressWidth}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #0099cc 0%, #00d4ff 100%)',
          transition: 'width 0.05s'
        }} />
      </div>
    </AbsoluteFill>
  );
};
