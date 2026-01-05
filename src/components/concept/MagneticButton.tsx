
import React, { useRef, useEffect, useState } from "react";
import gsap from "gsap";

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  strength?: number;
  onClick?: () => void;
}

const MagneticButton = ({
  children,
  className = "",
  strength = 30,
  onClick
}: MagneticButtonProps) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const button = buttonRef.current;
    const text = textRef.current;

    if (!button || !text) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);

      const distance = Math.sqrt(x * x + y * y);
      const maxDistance = Math.max(rect.width, rect.height);
      const factor = Math.min(distance / maxDistance, 1);

      // Move the button with easing
      gsap.to(button, {
        x: x * 0.4 * (1 - factor * 0.5),
        y: y * 0.4 * (1 - factor * 0.5),
        duration: 0.6,
        ease: "power3.out"
      });

      // Move the text with parallax (slightly more)
      gsap.to(text, {
        x: x * 0.15,
        y: y * 0.15,
        duration: 0.6,
        ease: "power3.out"
      });
    };

    const handleMouseEnter = () => {
      setIsHovered(true);
      gsap.to(button, {
        scale: 1.05,
        duration: 0.3,
        ease: "power2.out"
      });
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
      gsap.to([button, text], {
        x: 0,
        y: 0,
        scale: 1,
        duration: 0.8,
        ease: "elastic.out(1, 0.3)"
      });
    };

    button.addEventListener("mousemove", handleMouseMove);
    button.addEventListener("mouseenter", handleMouseEnter);
    button.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      button.removeEventListener("mousemove", handleMouseMove);
      button.removeEventListener("mouseenter", handleMouseEnter);
      button.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [strength]);

  return (
    <div
      ref={buttonRef}
      className={`inline-block cursor-pointer transition-shadow duration-300 ${isHovered ? 'filter drop-shadow-lg' : ''} ${className}`}
      onClick={onClick}
    >
      <span ref={textRef} className="block pointer-events-none">
        {children}
      </span>
    </div>
  );
};

export default MagneticButton;
