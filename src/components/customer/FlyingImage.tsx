import { useEffect, useState } from 'react';

export interface FlyAnimationState {
  imageSrc: string;
  startRect: DOMRect;
  endRect: DOMRect;
}

interface FlyingImageProps {
  animationState: FlyAnimationState;
  onComplete: () => void;
}

const FlyingImage = ({ animationState, onComplete }: FlyingImageProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const { imageSrc, startRect, endRect } = animationState;

  useEffect(() => {
    // Start animation after initial render
    const startTimeout = setTimeout(() => {
      setIsAnimating(true);
    }, 10);

    // Clean up and call onComplete after animation duration
    const endTimeout = setTimeout(() => {
      onComplete();
    }, 1500); // Match CSS transition duration

    return () => {
      clearTimeout(startTimeout);
      clearTimeout(endTimeout);
    };
  }, [onComplete]);

  // Initial position and size (matching source image)
  const initialStyle: React.CSSProperties = {
    position: 'fixed',
    top: startRect.top,
    left: startRect.left,
    width: startRect.width,
    height: startRect.height,
    zIndex: 9999,
    pointerEvents: 'none',
    transition: 'all 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    borderRadius: '8px',
    objectFit: 'cover',
  };

  // Final position and size (cart icon center, scaled down)
  const animatingStyle: React.CSSProperties = {
    ...initialStyle,
    top: endRect.top + endRect.height / 2,
    left: endRect.left + endRect.width / 2,
    width: 0,
    height: 0,
    transform: 'rotate(360deg) scale(0.1)',
    opacity: 0.5,
  };

  return (
    <img
      src={imageSrc}
      alt="Flying product"
      style={isAnimating ? animatingStyle : initialStyle}
    />
  );
};

export default FlyingImage;
