import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, ZoomOut, Loader2, Check } from "lucide-react";

interface Props {
  /** Image source. Either a File from a file input or an existing URL
   *  (e.g. when re-cropping a previously saved avatar). */
  source: File | string;
  /** Final output edge length in CSS pixels. Default 256 — gives a
   *  nice 256x256 PNG that scales fine to the 24px Navbar avatar and
   *  the 80px profile avatar. */
  size?: number;
  onSave: (blob: Blob) => Promise<void> | void;
  onCancel: () => void;
}

/**
 * Round avatar cropper. The user drags inside a 240px circle to pan
 * the image, uses a slider (or buttons) to zoom 1x..3x, and saves.
 * On save we render the visible region into a 256x256 canvas and
 * hand the parent a JPEG blob.
 *
 * Keeps it dependency-free so we don't drag a 30kb cropper library
 * just for this one screen.
 */
const AvatarCropper = ({ source, size = 256, onSave, onCancel }: Props) => {
  const VIEW = 240; // on-screen circle diameter
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  // Pan + zoom in CSS-pixel space relative to the centre of the circle.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // Build / tear down the object URL lifecycle.
  useEffect(() => {
    if (typeof source === "string") {
      setImgUrl(source);
      return;
    }
    const url = URL.createObjectURL(source);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  // Once the image element is loaded, choose an initial zoom so the
  // smaller dimension fills the circle (cover-fit). Without this a tall
  // portrait would start as a thin sliver in the middle.
  useEffect(() => {
    if (!imgEl) return;
    const compute = () => {
      const w = imgEl.naturalWidth;
      const h = imgEl.naturalHeight;
      if (!w || !h) return;
      const baseScale = VIEW / Math.min(w, h);
      // Track baseScale via transform: we keep `zoom` as a multiplier on
      // top of cover-fit so 1x = exact fit, 2x = 2x zoomed in.
      imgEl.dataset.baseScale = String(baseScale);
    };
    if (imgEl.complete) compute();
    else imgEl.addEventListener("load", compute);
    return () => imgEl.removeEventListener("load", compute);
  }, [imgEl]);

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

  const save = async () => {
    if (!imgEl) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clip to a circle so the saved PNG looks right against any background.
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const baseScale = Number(imgEl.dataset.baseScale ?? 1);
      // Effective scale = cover-fit × user zoom. Apply to natural dims.
      const drawW = imgEl.naturalWidth * baseScale * zoom;
      const drawH = imgEl.naturalHeight * baseScale * zoom;
      // Map screen-space offset to canvas-space (size / VIEW ratio).
      const ratio = size / VIEW;
      const cx = size / 2 + offset.x * ratio;
      const cy = size / 2 + offset.y * ratio;

      ctx.drawImage(
        imgEl,
        cx - (drawW * ratio) / 2,
        cy - (drawH * ratio) / 2,
        drawW * ratio,
        drawH * ratio,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
      );
      if (blob) await onSave(blob);
    } finally {
      setBusy(false);
    }
  };

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
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${
                    imgEl ? Number(imgEl.dataset.baseScale ?? 1) * zoom : 1
                  })`,
                  transformOrigin: "center center",
                  pointerEvents: "none",
                  willChange: "transform",
                }}
              />
            )}
            {/* Subtle ring to mark the visible boundary. */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)" }}
            />
          </div>

          <p className="mt-3 label-mono text-[10px] text-muted-foreground/80 text-center">
            Тінтуірмен сүйреп, ұсталыңыз. Үлкейту үшін слайдерді басыңыз.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut size={14} strokeWidth={1.6} />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn size={14} strokeWidth={1.6} />
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
