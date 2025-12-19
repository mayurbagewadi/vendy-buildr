import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

export const useLandingAnimations = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Smooth scroll for navigation links
    const handleSmoothScroll = (e: Event) => {
      e.preventDefault();
      const target = e.currentTarget as HTMLAnchorElement;
      const targetId = target.getAttribute('href');

      if (targetId && targetId.startsWith('#')) {
        const element = document.querySelector(targetId);
        if (element) {
          const offsetTop = element.getBoundingClientRect().top + window.pageYOffset - 80;
          window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
          });
        }
      }
    };

    // Add smooth scroll to all anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
      link.addEventListener('click', handleSmoothScroll);
    });

    // Hero Section Animations
    if (heroRef.current) {
      const badge = heroRef.current.querySelector('.hero-badge');
      const heading = heroRef.current.querySelector('.hero-heading');
      const subheading = heroRef.current.querySelector('.hero-subheading');
      const cta = heroRef.current.querySelector('.hero-cta');
      const trust = heroRef.current.querySelector('.hero-trust');
      const decorative = heroRef.current.querySelectorAll('.hero-decorative');

      // Parallax effect on decorative elements
      decorative.forEach((el, index) => {
        gsap.to(el, {
          yPercent: index % 2 === 0 ? 30 : -30,
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 1,
          }
        });
      });

      // Hero text reveal animation
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(badge,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.8 }
      )
      .fromTo(heading,
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 1, stagger: 0.1 },
        '-=0.4'
      )
      .fromTo(subheading,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8 },
        '-=0.6'
      )
      .fromTo(cta,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8 },
        '-=0.4'
      )
      .fromTo(trust,
        { opacity: 0 },
        { opacity: 1, duration: 0.8 },
        '-=0.4'
      );
    }

    // Features Section - Scroll-triggered animations
    if (featuresRef.current) {
      const featureCards = featuresRef.current.querySelectorAll('.feature-card');

      featureCards.forEach((card, index) => {
        gsap.fromTo(card,
          {
            opacity: 0,
            y: 60,
            scale: 0.9
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 95%',
              end: 'bottom 20%',
              toggleActions: 'play none none reverse',
            },
            delay: index * 0.1
          }
        );

        // Parallax effect on hover
        card.addEventListener('mouseenter', () => {
          gsap.to(card, {
            y: -10,
            duration: 0.3,
            ease: 'power2.out'
          });
        });

        card.addEventListener('mouseleave', () => {
          gsap.to(card, {
            y: 0,
            duration: 0.3,
            ease: 'power2.out'
          });
        });
      });
    }

    // Steps Section - Sequential reveal animation
    if (stepsRef.current) {
      const stepCards = stepsRef.current.querySelectorAll('.step-card');

      gsap.fromTo(stepCards,
        {
          opacity: 0,
          x: -50,
          scale: 0.95
        },
        {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.15,
          scrollTrigger: {
            trigger: stepsRef.current,
            start: 'top 70%',
            end: 'bottom 20%',
            toggleActions: 'play none none reverse',
          }
        }
      );
    }

    // Cleanup function
    return () => {
      anchorLinks.forEach(link => {
        link.removeEventListener('click', handleSmoothScroll);
      });
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  return {
    heroRef,
    featuresRef,
    stepsRef
  };
};
