import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, ZoomOut, Loader2, Check, RotateCw } from "lucide-react";

interface Props {
  /** Image source. Either a File from a file input or an existing URL
   *  (e.g. when re-cropping a previously saved avatar). */
  source: File | string;
  /** Final output edge length in CSS pixels. Default 256. */
  size?: number;
  onSave: (blob: Blob) => Promise<void> | void;
  onCancel: () => void;
}

const VIEW = 240; // round preview diameter in px
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

const AvatarCropper = ({ source, size = 256, onSave, onCancel }: Props) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // Multiples of 90° applied AFTER drag/zoom. Stays small (0/90/180/270)
  // so the canvas math is just an axis flip.
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  // ESC to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  useEffect(() => {
    if (typeof source === "string") {
      setImgUrl(source);
      return;
    }
    const url = URL.createObjectURL(source);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  // Cover-fit baseline so the image starts filling the circle on load.
  useEffect(() => {
    if (!imgEl) return;
    const compute = () => {
      const w = imgEl.naturalWidth;
      const h = imgEl.naturalHeight;
      if (!w || !h) return;
      // After rotation 90/270 the image's effective short side flips,
      // but we keep the cover-fit baseline static — the container is
      // round, so it's fine, the user can re-zoom if they want.
      const baseScale = VIEW / Math.min(w, h);
      imgEl.dataset.baseScale = String(baseScale);
    };
    if (imgEl.complete) compute();
    else imgEl.addEventListener("load", compute);
    return () => imgEl.removeEventListener("load", compute);
  }, [imgEl]);

  // ── Drag (pan) ───────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.baseY + (e.clientY - dragRef.current.startY),
    });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  // ── Custom slider (range input rendered inconsistently on Safari) ────
  const updateZoomFromClientX = (clientX: number) => {
    const el = sliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setZoom(ZOOM_MIN + ratio * (ZOOM_MAX - ZOOM_MIN));
  };
  const onSliderPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updateZoomFromClientX(e.clientX);
  };
  const onSliderPointerMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return; // primary button down only
    updateZoomFromClientX(e.clientX);
  };

  // ── Save: render to canvas with the same transform stack ─────────────
  const save = async () => {
    if (!imgEl) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Round clip so the saved JPEG composites well anywhere.
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const baseScale = Number(imgEl.dataset.baseScale ?? 1);
      const ratio = size / VIEW;
      const cx = size / 2 + offset.x * ratio;
      const cy = size / 2 + offset.y * ratio;
      const drawW = imgEl.naturalWidth * baseScale * zoom * ratio;
      const drawH = imgEl.naturalHeight * baseScale * zoom * ratio;

      // Apply the user's rotation around the centre of the visible
      // crop, then draw the image relative to that origin.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(imgEl, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
      );
      if (blob) await onSave(blob);
    } finally {
      setBusy(false);
    }
  };

  const zoomPct = ((zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center px-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative bg-card border border-border p-6 max-w-sm w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.6} />
          </button>

          <span className="label-mono text-[10px] text-muted-foreground block mb-4">
            АВАТАРДЫ ОРНАЛАСТЫРУ
          </span>

          <div
            className="relative mx-auto bg-muted/40 overflow-hidden cursor-grab active:cursor-grabbing select-none"
            style={{
              width: VIEW,
              height: VIEW,
              borderRadius: "50%",
              touchAction: "none",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {imgUrl && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img
                ref={setImgEl}
                src={imgUrl}
                draggable={false}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${rotation}deg) scale(${
                    imgEl ? Number(imgEl.dataset.baseScale ?? 1) * zoom : 1
                  })`,
                  transformOrigin: "center center",
                  pointerEvents: "none",
                  willChange: "transform",
                  maxWidth: "none",
                }}
              />
            )}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)" }}
            />
          </div>

          <p className="mt-3 label-mono text-[10px] text-muted-foreground/80 text-center">
            Тінтуірмен/саусақпен сүйреп орналастырыңыз
          </p>

          {/* Custom slider — input[type=range] rendered weirdly across
              browsers (esp. Safari iOS). Plain divs + pointer events
              are predictable. */}
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.25).toFixed(2)))}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Zoom out"
            >
              <ZoomOut size={14} strokeWidth={1.6} />
            </button>
            <div
              ref={sliderRef}
              role="slider"
              aria-valuemin={ZOOM_MIN}
              aria-valuemax={ZOOM_MAX}
              aria-valuenow={zoom}
              tabIndex={0}
              onPointerDown={onSliderPointerDown}
              onPointerMove={onSliderPointerMove}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.1).toFixed(2)));
                if (e.key === "ArrowRight") setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.1).toFixed(2)));
              }}
              className="relative flex-1 h-6 cursor-pointer touch-none"
            >
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-border" />
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary"
                style={{ width: `${zoomPct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background shadow"
                style={{ left: `${zoomPct}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.25).toFixed(2)))}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Zoom in"
            >
              <ZoomIn size={14} strokeWidth={1.6} />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setRotation((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270))}
              className="inline-flex items-center gap-1.5 border border-border hover:border-foreground label-mono text-[10px] px-3 py-1.5 transition-colors"
              title="Бұру 90°"
            >
              <RotateCw size={11} strokeWidth={1.6} />
              90°
            </button>
            <button
              type="button"
              onClick={() => {
                setOffset({ x: 0, y: 0 });
                setZoom(1);
                setRotation(0);
              }}
              className="label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Қалпына келтіру
            </button>
          </div>

          <div className="mt-6 flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="border border-border hover:border-foreground label-mono text-[10px] px-3 py-2 transition-colors disabled:opacity-50"
            >
              Болдырмау
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy || !imgEl}
              className="bg-primary text-primary-foreground hover:bg-primary/90 label-mono text-[10px] px-3 py-2 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {busy ? (
                <Loader2 size={11} strokeWidth={1.6} className="animate-spin" />
              ) : (
                <Check size={11} strokeWidth={2} />
              )}
              Сақтау
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AvatarCropper;
