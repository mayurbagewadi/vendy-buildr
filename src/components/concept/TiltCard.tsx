
import React, { useRef, useEffect } from "react";
import gsap from "gsap";

interface TiltCardProps {
    children: React.ReactNode;
    className?: string;
    glareColor?: string;
    tiltAmount?: number;
}

const TiltCard = ({
    children,
    className = "",
    glareColor = "rgba(255, 255, 255, 0.15)",
    tiltAmount = 15
}: TiltCardProps) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);
    const shineRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const card = cardRef.current;

        if (!card) return;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -tiltAmount;
            const rotateY = ((x - centerX) / centerX) * tiltAmount;

            gsap.to(card, {
                rotateX: rotateX,
                rotateY: rotateY,
                duration: 0.4,
                ease: "power2.out",
                transformPerspective: 1000,
                transformStyle: "preserve-3d"
            });

            // Glare effect
            if (glareRef.current) {
                const glareX = (x / rect.width) * 100;
                const glareY = (y / rect.height) * 100;
                gsap.to(glareRef.current, {
                    background: `radial-gradient(circle at ${glareX}% ${glareY}%, ${glareColor}, transparent 60%)`,
                    opacity: 0.8,
                    duration: 0.4
                });
            }

            // Shine line effect
            if (shineRef.current) {
                gsap.to(shineRef.current, {
                    x: x - rect.width / 2,
                    y: y - rect.height / 2,
                    opacity: 1,
                    duration: 0.4
                });
            }
        };

        const handleMouseEnter = () => {
            gsap.to(card, {
                scale: 1.02,
                duration: 0.3,
                ease: "power2.out"
            });
        };

        const handleMouseLeave = () => {
            gsap.to(card, {
                rotateX: 0,
                rotateY: 0,
                scale: 1,
                duration: 0.6,
                ease: "elastic.out(1, 0.5)"
            });

            if (glareRef.current) {
                gsap.to(glareRef.current, {
                    opacity: 0,
                    duration: 0.4
                });
            }

            if (shineRef.current) {
                gsap.to(shineRef.current, {
                    opacity: 0,
                    duration: 0.4
                });
            }
        };

        card.addEventListener("mousemove", handleMouseMove);
        card.addEventListener("mouseenter", handleMouseEnter);
        card.addEventListener("mouseleave", handleMouseLeave);

        return () => {
            card.removeEventListener("mousemove", handleMouseMove);
            card.removeEventListener("mouseenter", handleMouseEnter);
            card.removeEventListener("mouseleave", handleMouseLeave);
        };
    }, [tiltAmount, glareColor]);

    return (
        <div
            ref={cardRef}
            className={`relative overflow-hidden ${className}`}
            style={{ transformStyle: "preserve-3d" }}
        >
            <div className="relative z-10" style={{ transform: "translateZ(20px)" }}>
                {children}
            </div>

            {/* Glare overlay */}
            <div
                ref={glareRef}
                className="absolute inset-0 pointer-events-none z-20 opacity-0"
                style={{ mixBlendMode: "overlay" }}
            />

            {/* Shine line */}
            <div
                ref={shineRef}
                className="absolute inset-0 pointer-events-none z-30 opacity-0"
                style={{
                    background: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
                    width: "200%",
                    height: "200%",
                    top: "-50%",
                    left: "-50%"
                }}
            />
        </div>
    );
};

export default TiltCard;
