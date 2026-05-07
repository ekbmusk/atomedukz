import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { slideUrl } from "@/hooks/useTopics";
import { NotchProgress } from "@/components/atoms/AtomicGlyphs";

interface LectureReaderProps {
  weekNumber: number;
  slidesCount: number;
}

const ZOOM_STEPS = [1, 1.25, 1.5, 2, 3];

const LectureReader = ({ weekNumber, slidesCount }: LectureReaderProps) => {
  const { t } = useLang();
  const [idx, setIdx] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(0); // index into ZOOM_STEPS
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, slidesCount - 1)), [slidesCount]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);
  const zoomIn = useCallback(() => setZoomLevel((z) => Math.min(z + 1, ZOOM_STEPS.length - 1)), []);
  const zoomOut = useCallback(() => setZoomLevel((z) => Math.max(z - 1, 0)), []);
  const reset = useCallback(() => setZoomLevel(0), []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.().catch(() => undefined);
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.().catch(() => undefined);
      setFullscreen(false);
    }
  }, []);

  // Sync fullscreen state on Escape exit
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prev();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "-":
          e.preventDefault();
          zoomOut();
          break;
        case "0":
          e.preventDefault();
          reset();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, toggleFullscreen, zoomIn, zoomOut, reset]);

  if (slidesCount === 0) {
    return (
      <div className="border border-border p-12 text-center">
        <p className="label-mono text-[11px] text-muted-foreground">{t.lecture.noSlides}</p>
      </div>
    );
  }

  const zoom = ZOOM_STEPS[zoomLevel];
  const url = slideUrl(weekNumber, idx + 1);

  return (
    <div ref={containerRef} className={`relative ${fullscreen ? "bg-background p-6" : ""}`}>
      {/* Top toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <span className="label-mono text-[10px] text-muted-foreground">{t.lecture.slide}</span>
          <span className="font-display tabular text-2xl text-foreground">
            {String(idx + 1).padStart(2, "0")}
          </span>
          <span className="label-mono text-[10px] text-muted-foreground">{t.lecture.of}</span>
          <span className="font-display tabular text-base text-muted-foreground">
            {String(slidesCount).padStart(2, "0")}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <ToolBtn onClick={zoomOut} disabled={zoomLevel === 0} label={t.lecture.zoomOut}>
            <ZoomOut size={14} strokeWidth={1.4} />
          </ToolBtn>
          <span className="label-mono text-[10px] text-muted-foreground tabular px-2 min-w-[3em] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <ToolBtn onClick={zoomIn} disabled={zoomLevel === ZOOM_STEPS.length - 1} label={t.lecture.zoomIn}>
            <ZoomIn size={14} strokeWidth={1.4} />
          </ToolBtn>
          <ToolBtn onClick={reset} label={t.lecture.reset}>
            <RotateCcw size={13} strokeWidth={1.4} />
          </ToolBtn>
          <span className="w-3 h-px bg-border mx-1" aria-hidden />
          <ToolBtn onClick={toggleFullscreen} label={fullscreen ? t.lecture.exitFullscreen : t.lecture.fullscreen}>
            {fullscreen ? <Minimize2 size={13} strokeWidth={1.4} /> : <Maximize2 size={13} strokeWidth={1.4} />}
          </ToolBtn>
        </div>
      </div>

      {/* Notch progress */}
      <NotchProgress current={idx + 1} total={slidesCount} className="mb-4" />

      {/* Slide canvas */}
      <div className="relative border border-border bg-card/40 overflow-auto" style={{ aspectRatio: fullscreen ? undefined : "16 / 9", maxHeight: fullscreen ? "calc(100vh - 200px)" : undefined }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div
              className="transition-transform duration-200 origin-center"
              style={{ transform: `scale(${zoom})` }}
            >
              <img
                src={url}
                alt={`${t.lecture.slide} ${idx + 1}`}
                className="max-w-full max-h-full object-contain select-none"
                draggable={false}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
                }}
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Floating prev/next */}
        <button
          onClick={prev}
          disabled={idx === 0}
          aria-label={t.lecture.prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 border border-border bg-background/80 backdrop-blur flex items-center justify-center hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={1.4} />
        </button>
        <button
          onClick={next}
          disabled={idx === slidesCount - 1}
          aria-label={t.lecture.next}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 border border-border bg-background/80 backdrop-blur flex items-center justify-center hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} strokeWidth={1.4} />
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="mt-3 label-mono text-[9px] text-muted-foreground/70 text-right">
        {t.lecture.keyboardHint}
      </div>
    </div>
  );
};

const ToolBtn = ({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
  >
    {children}
  </button>
);

export default LectureReader;
