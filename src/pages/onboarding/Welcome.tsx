import { useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const COLORS = [
  "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff",
  "#ff6bca", "#ff9f43", "#a29bfe", "#fd79a8", "#ffffff",
];

const WelcomePage = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Floating particle config — stable across renders
  const floatingParticles = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: `${8 + (i * 6.5) % 84}%`,
      size: 6 + (i % 5) * 3,
      delay: (i * 0.4) % 3,
      duration: 6 + (i % 4) * 1.5,
      opacity: 0.15 + (i % 3) * 0.07,
      color: COLORS[i % COLORS.length],
    })),
  []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Types ────────────────────────────────────────────────────────────────
    type Piece = {
      x: number; y: number; vx: number; vy: number;
      color: string; w: number; h: number;
      rot: number; rotSpeed: number; opacity: number;
    };
    type Spark = {
      x: number; y: number; vx: number; vy: number;
      color: string; life: number; maxLife: number; size: number;
    };

    // ── Factories ────────────────────────────────────────────────────────────
    const makePiece = (yOffset = 0): Piece => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * yOffset,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 1.6 + 1.2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.14,
      opacity: 1,
    });

    const makeSpark = (x: number, y: number): Spark => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7 + 1.5;
      const life = Math.random() * 45 + 35;
      return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        maxLife: life, life, size: Math.random() * 3 + 1,
      };
    };

    const burst = (x: number, y: number) => {
      for (let i = 0; i < 70; i++) sparks.push(makeSpark(x, y));
    };

    // ── State ────────────────────────────────────────────────────────────────
    let pieces: Piece[] = Array.from({ length: 200 }, () => makePiece(400));
    let sparks: Spark[] = [];

    // ── Firework schedule ────────────────────────────────────────────────────
    const W = canvas.width;
    const H = canvas.height;
    const timers = [
      setTimeout(() => burst(W * 0.22, H * 0.28), 80),
      setTimeout(() => burst(W * 0.78, H * 0.22), 380),
      setTimeout(() => burst(W * 0.5,  H * 0.18), 700),
      setTimeout(() => burst(W * 0.12, H * 0.38), 1050),
      setTimeout(() => burst(W * 0.88, H * 0.32), 1300),
      setTimeout(() => burst(W * 0.5,  H * 0.26), 1750),
      setTimeout(() => burst(W * 0.3,  H * 0.22), 2300),
      setTimeout(() => burst(W * 0.7,  H * 0.19), 2600),
      // second confetti wave
      setTimeout(() => {
        pieces.push(...Array.from({ length: 120 }, () => makePiece(80)));
      }, 900),
    ];

    // ── Render loop ──────────────────────────────────────────────────────────
    let raf: number;
    let frame = 0;

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // confetti
      pieces.forEach(p => {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.035;
        p.rot += p.rotSpeed;
        if (p.y > canvas.height * 0.72) p.opacity -= 0.014;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      pieces = pieces.filter(p => p.opacity > 0 && p.y < canvas.height + 50);

      // sparks
      sparks.forEach(p => {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.09;
        p.vx *= 0.97;
        p.life--;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      sparks = sparks.filter(p => p.life > 0);

      frame++;
      if (frame < 400 || pieces.length > 0 || sparks.length > 0) {
        raf = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center overflow-hidden">

      {/* Canvas — confetti + fireworks */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-10"
      />

      {/* Floating background particles */}
      {floatingParticles.map(p => (
        <motion.span
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: p.left,
            bottom: -20,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            opacity: p.opacity,
          }}
          animate={{ y: [0, -(window.innerHeight + 60)] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.82, y: 48 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.34, 1.46, 0.64, 1] }}
        className="relative z-20 bg-card rounded-2xl shadow-2xl border p-8 md:p-12 max-w-md w-full mx-4 text-center"
      >
        {/* Emoji */}
        <motion.div
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.38, duration: 0.55, type: "spring", stiffness: 220, damping: 14 }}
          className="text-6xl mb-6 select-none"
        >
          🎉
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.52, duration: 0.4, ease: "easeOut" }}
          className="text-3xl md:text-4xl font-bold mb-4"
        >
          Your Store is Live!
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.64, duration: 0.4, ease: "easeOut" }}
          className="text-muted-foreground text-base md:text-lg leading-relaxed mb-10"
        >
          Congratulations! You've successfully set up your store on DigitalDukandar. Everything is ready. Now it's time to start selling.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.78, duration: 0.4, ease: "easeOut" }}
        >
          <Button
            size="lg"
            onClick={() => navigate("/admin/dashboard")}
            className="min-h-[52px] px-10 text-base font-semibold w-full sm:w-auto"
          >
            Go to Dashboard
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default WelcomePage;
