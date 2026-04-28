import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayCircle, PauseCircle, Volume2, X } from 'lucide-react';

const STORAGE_KEY = 'dd_intro_played_v1';
const AUDIO_SRC = '/audio/intro.mp3';

// ─── Positioning relative to WhatsApp button ───────────────────────────────
// WhatsApp: bottom-3(12px)/sm:4(16px)/md:6(24px), height h-14 = 56px, gap 8px
// Audio btn: 12+56+8=76 / 16+56+8=80 / 24+56+8=88px from bottom
// Card: audio-btn-height=52px, 76+52+8=136 / 80+52+8=140 / 88+52+8=148

const IntroAudio = () => {
  // Detect return visitor once at mount (stable for lifetime of component)
  const isReturnVisitor = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  })[0];

  const audioRef         = useRef<HTMLAudioElement | null>(null);
  const hasTriggeredRef  = useRef(false);
  const scrollCleanupRef = useRef<(() => void) | null>(null);

  const [isPlaying,    setIsPlaying]    = useState(false);
  const [btnVisible,   setBtnVisible]   = useState(false);
  const [showCard,     setShowCard]     = useState(false);
  const [cardDismissed,setCardDismissed]= useState(false);

  // ── Mark audio as played in localStorage ──────────────────────────────────
  const markPlayed = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
    setShowCard(false);
  }, []);

  // ── Core autoplay attempt ─────────────────────────────────────────────────
  const attemptAutoplay = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio || hasTriggeredRef.current) return false;
    hasTriggeredRef.current = true;

    try {
      await audio.play();
      markPlayed();
      return true;
    } catch {
      hasTriggeredRef.current = false; // allow retry on user gesture
      setShowCard(true);
      return false;
    }
  }, [markPlayed]);

  // ── Main effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = new Audio(AUDIO_SRC);
    audio.preload = 'none';
    audio.volume  = 1;
    audioRef.current = audio;

    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('play',  onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    if (isReturnVisitor) {
      // ── Return visitor: show button instantly at dim opacity, no auto-triggers
      setBtnVisible(true);
    } else {
      // ── First-time visitor: autoplay only after 3s elapsed AND scrolled once
      let has3sElapsed = false;
      let hasScrolled  = false;

      const tryPlay = () => {
        if (has3sElapsed && hasScrolled) attemptAutoplay();
      };

      const showTimer = window.setTimeout(() => setBtnVisible(true), 600);
      const autoTimer = window.setTimeout(() => {
        has3sElapsed = true;
        tryPlay();
      }, 3000);

      const onScroll = () => {
        if (!hasTriggeredRef.current) {
          hasScrolled = true;
          tryPlay();
          // Keep listener active until play actually triggers
          if (hasTriggeredRef.current) {
            window.removeEventListener('scroll', onScroll);
          }
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      scrollCleanupRef.current = () => window.removeEventListener('scroll', onScroll);

      return () => {
        clearTimeout(showTimer);
        clearTimeout(autoTimer);
        scrollCleanupRef.current?.();
        audio.removeEventListener('play',  onPlay);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('ended', onEnded);
        audio.pause();
        audio.src = '';
        audioRef.current = null;
      };
    }

    return () => {
      audio.removeEventListener('play',  onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [isReturnVisitor, attemptAutoplay]);

  // ── Button click: toggle play / pause ─────────────────────────────────────
  const handleButtonClick = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      if (audio.ended) audio.currentTime = 0;
      try {
        await audio.play();
        hasTriggeredRef.current = true;
        markPlayed();
      } catch (e) {
        console.warn('[IntroAudio] play() blocked:', e);
        setShowCard(true);
      }
    }
  }, [isPlaying, markPlayed]);

  // ── Permission card CTA ───────────────────────────────────────────────────
  const handlePermissionPlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    hasTriggeredRef.current = false;
    try {
      await audio.play();
      hasTriggeredRef.current = true;
      markPlayed();
    } catch (e) {
      console.warn('[IntroAudio] permission play blocked:', e);
    }
  }, [markPlayed]);

  // ── Derived opacity ───────────────────────────────────────────────────────
  // Return visitor idle → 0.5
  // Anyone playing      → 0.5
  // First visitor idle  → 1.0
  const buttonOpacity = isPlaying ? 0.5 : isReturnVisitor ? 0.5 : 1;

  return (
    <>
      {/* ── Floating Play / Pause Button ─────────────────────────────────── */}
      <AnimatePresence>
        {btnVisible && (
          <motion.button
            key="intro-audio-btn"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: buttonOpacity, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            whileHover={{ opacity: 1, scale: 1.1 }}
            whileTap={{ scale: 0.88 }}
            onClick={handleButtonClick}
            aria-label={isPlaying ? 'Pause intro audio' : 'Play intro audio'}
            title={isPlaying ? 'Pause intro' : 'Play intro audio'}
            className={[
              'fixed z-[99] flex items-center justify-center',
              'rounded-full bg-primary shadow-xl',
              'hover:shadow-2xl cursor-pointer',
              'focus:outline-none focus-visible:ring-2',
              'focus-visible:ring-primary focus-visible:ring-offset-2',
              'bottom-[76px] right-3',
              'sm:bottom-20 sm:right-4',
              'md:bottom-[88px] md:right-6',
            ].join(' ')}
            style={{ width: 52, height: 52 }}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.span
                  key="pause-icon"
                  initial={{ scale: 0.65, opacity: 0, rotate: -20 }}
                  animate={{ scale: 1,    opacity: 1, rotate: 0  }}
                  exit={{    scale: 0.65, opacity: 0, rotate: 20 }}
                  transition={{ duration: 0.18 }}
                  style={{ display: 'flex' }}
                >
                  <PauseCircle className="w-7 h-7 text-primary-foreground" strokeWidth={1.8} />
                </motion.span>
              ) : (
                <motion.span
                  key="play-icon"
                  initial={{ scale: 0.65, opacity: 0, rotate: 20  }}
                  animate={{ scale: 1,    opacity: 1, rotate: 0   }}
                  exit={{    scale: 0.65, opacity: 0, rotate: -20 }}
                  transition={{ duration: 0.18 }}
                  style={{ display: 'flex' }}
                >
                  <PlayCircle className="w-7 h-7 text-primary-foreground" strokeWidth={1.8} />
                </motion.span>
              )}
            </AnimatePresence>

            {/* Pulse ring while playing */}
            {isPlaying && (
              <motion.span
                className="absolute inset-0 rounded-full bg-primary"
                animate={{ scale: [1, 1.55], opacity: [0.35, 0] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut' }}
                style={{ pointerEvents: 'none' }}
              />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Browser Permission Card (first-time visitors only) ───────────── */}
      <AnimatePresence>
        {!isReturnVisitor && showCard && !cardDismissed && (
          <motion.div
            key="intro-permission-card"
            role="dialog"
            aria-label="DigitalDukandar wants to talk with you"
            initial={{ opacity: 0, y: 28, scale: 0.92 }}
            animate={{ opacity: 1,  y: 0,  scale: 1    }}
            exit={{    opacity: 0,  y: 18, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className={[
              'fixed z-[99] w-72',
              'bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden',
              'bottom-[136px] right-3',
              'sm:bottom-[140px] sm:right-4',
              'md:bottom-[148px] md:right-6',
            ].join(' ')}
          >
            {/* Top gradient accent bar */}
            <div className="h-[3px] w-full bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

            <div className="p-5 relative">
              {/* Dismiss ✕ */}
              <button
                onClick={() => setCardDismissed(true)}
                aria-label="Dismiss"
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors rounded-full p-0.5 hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Pulsing icon */}
              <div className="relative w-12 h-12 mb-4">
                <motion.div
                  className="absolute inset-0 rounded-full bg-primary/20"
                  animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: 'easeOut' }}
                />
                <div className="relative w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Volume2 className="w-6 h-6 text-primary" />
                </div>
              </div>

              {/* Message */}
              <p className="text-sm font-bold text-foreground leading-tight">
                DigitalDukandar.in
              </p>
              <p className="text-sm text-muted-foreground mt-0.5 mb-4 leading-snug">
                want to talk with you
              </p>

              {/* CTA */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handlePermissionPlay}
                className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <PlayCircle className="w-4 h-4" />
                Play Audio
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default IntroAudio;
