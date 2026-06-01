import { useEffect, useRef, useState, useCallback } from 'react';
import { PlayCircle, PauseCircle, Volume2, X } from 'lucide-react';

const STORAGE_KEY = 'dd_intro_played_v1';
const AUDIO_SRC = '/audio/intro.mp3';

const IntroAudio = () => {
  const isReturnVisitor = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  })[0];

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasTriggeredRef = useRef(false);
  const scrollCleanupRef = useRef<(() => void) | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [btnVisible, setBtnVisible] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [cardDismissed, setCardDismissed] = useState(false);

  const markPlayed = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
    setShowCard(false);
  }, []);

  const attemptAutoplay = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio || hasTriggeredRef.current) return false;
    hasTriggeredRef.current = true;

    try {
      await audio.play();
      markPlayed();
      return true;
    } catch {
      hasTriggeredRef.current = false;
      setShowCard(true);
      return false;
    }
  }, [markPlayed]);

  useEffect(() => {
    const audio = new Audio(AUDIO_SRC);
    audio.preload = 'none';
    audio.volume = 1;
    audioRef.current = audio;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    if (isReturnVisitor) {
      setBtnVisible(true);
    } else {
      let has3sElapsed = false;
      let hasScrolled = false;

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
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('ended', onEnded);
        audio.pause();
        audio.src = '';
        audioRef.current = null;
      };
    }

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [isReturnVisitor, attemptAutoplay]);

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

  const buttonOpacity = isPlaying ? 0.5 : isReturnVisitor ? 0.5 : 1;

  return (
    <>
      {btnVisible && (
        <button
          onClick={handleButtonClick}
          aria-label={isPlaying ? 'Pause intro audio' : 'Play intro audio'}
          title={isPlaying ? 'Pause intro' : 'Play intro audio'}
          className={[
            'fixed z-[99] flex items-center justify-center',
            'rounded-full bg-primary shadow-xl',
            'hover:opacity-100 hover:scale-105 active:scale-95 cursor-pointer',
            'focus:outline-none focus-visible:ring-2',
            'focus-visible:ring-primary focus-visible:ring-offset-2',
            'bottom-[76px] right-3',
            'sm:bottom-20 sm:right-4',
            'md:bottom-[88px] md:right-6',
            'transition-[opacity,transform] duration-300 ease-out',
          ].join(' ')}
          style={{ width: 52, height: 52, opacity: buttonOpacity }}
        >
          <span className="flex">
            {isPlaying ? (
              <PauseCircle className="w-7 h-7 text-primary-foreground" strokeWidth={1.8} />
            ) : (
              <PlayCircle className="w-7 h-7 text-primary-foreground" strokeWidth={1.8} />
            )}
          </span>
          {isPlaying && (
            <span
              className="absolute inset-0 rounded-full bg-primary animate-audio-pulse"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </button>
      )}

      {!isReturnVisitor && showCard && !cardDismissed && (
        <div
          role="dialog"
          aria-label="DigitalDukandar wants to talk with you"
          className={[
            'fixed z-[99] w-72',
            'bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden',
            'bottom-[136px] right-3',
            'sm:bottom-[140px] sm:right-4',
            'md:bottom-[148px] md:right-6',
            'animate-card-enter',
          ].join(' ')}
        >
          <div className="h-[3px] w-full bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

          <div className="p-5 relative">
            <button
              onClick={() => setCardDismissed(true)}
              aria-label="Dismiss"
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors rounded-full p-0.5 hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative w-12 h-12 mb-4">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-audio-pulse" />
              <div className="relative w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Volume2 className="w-6 h-6 text-primary" />
              </div>
            </div>

            <p className="text-sm font-bold text-foreground leading-tight">
              DigitalDukandar.in
            </p>
            <p className="text-sm text-muted-foreground mt-0.5 mb-4 leading-snug">
              want to talk with you
            </p>

            <button
              onClick={handlePermissionPlay}
              className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-[opacity,transform]"
            >
              <PlayCircle className="w-4 h-4" />
              Play Audio
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default IntroAudio;
