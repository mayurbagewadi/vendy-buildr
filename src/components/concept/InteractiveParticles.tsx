
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export const InteractiveParticles = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const particles = containerRef.current.querySelectorAll('.particle');

        // Initial random layout with varied sizes
        particles.forEach((particle, i) => {
            const size = Math.random() * 6 + 2;
            gsap.set(particle, {
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                scale: 1,
                width: size,
                height: size,
                opacity: Math.random() * 0.5 + 0.1
            });

            // Continuous floating with varied speeds
            gsap.to(particle, {
                y: `+=${Math.random() * 300 - 150}`,
                x: `+=${Math.random() * 300 - 150}`,
                duration: Math.random() * 15 + 10,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
                delay: Math.random() * 3
            });

            // Subtle pulsing
            gsap.to(particle, {
                opacity: Math.random() * 0.3 + 0.2,
                scale: 1.5,
                duration: Math.random() * 4 + 2,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
                delay: Math.random() * 2
            });
        });

        // Mouse interaction with smooth repulsion
        let mouseX = 0, mouseY = 0;
        let rafId: number;

        const handleMouseMove = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        };

        const animate = () => {
            particles.forEach((particle) => {
                const rect = particle.getBoundingClientRect();
                const particleX = rect.left + rect.width / 2;
                const particleY = rect.top + rect.height / 2;

                const distanceX = mouseX - particleX;
                const distanceY = mouseY - particleY;
                const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

                if (distance < 150) {
                    const angle = Math.atan2(distanceY, distanceX);
                    const force = (150 - distance) / 8;
                    const moveX = Math.cos(angle) * -force;
                    const moveY = Math.sin(angle) * -force;

                    gsap.to(particle, {
                        x: `+=${moveX}`,
                        y: `+=${moveY}`,
                        duration: 0.3,
                        ease: 'power2.out'
                    });
                }
            });

            rafId = requestAnimationFrame(animate);
        };

        window.addEventListener('mousemove', handleMouseMove);
        rafId = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(rafId);
        };
    }, []);

    // More particles with varied colors
    const particleColors = [
        'rgba(139, 92, 246, 0.6)', // violet
        'rgba(236, 72, 153, 0.5)', // pink
        'rgba(59, 130, 246, 0.5)', // blue
        'rgba(168, 85, 247, 0.5)', // purple
        'rgba(34, 211, 238, 0.4)', // cyan
    ];

    return (
        <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 60 }).map((_, i) => (
                <div
                    key={i}
                    className="particle absolute rounded-full"
                    style={{
                        background: `radial-gradient(circle, ${particleColors[i % particleColors.length]}, transparent 70%)`,
                        filter: 'blur(0.5px)',
                        boxShadow: `0 0 10px ${particleColors[i % particleColors.length]}`
                    }}
                />
            ))}
        </div>
    );
};
