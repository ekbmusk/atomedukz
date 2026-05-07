import { useRef, useState } from "react";
import { Camera, Loader2, Upload } from "lucide-react";
import Avatar from "@/components/Avatar";

interface Props {
  url: string | null | undefined;
  name: string | null | undefined;
  size: number;
  busy?: boolean;
  /** Called when the user picks or drops a valid image file. The
   *  parent decides what to do — typically open the cropper. */
  onPickFile: (file: File) => void;
  /** Hard cap before we even hand the file to the parent (4 MB by
   *  default mirrors uploadAvatar). */
  maxBytes?: number;
  onTooLarge?: () => void;
}

/**
 * Avatar tile that doubles as a drop target. Click → file picker;
 * drag-and-drop an image → same flow. The hover state highlights
 * the drop zone so users know they can drag-drop.
 */
const AvatarUploadButton = ({
  url,
  name,
  size,
  busy = false,
  onPickFile,
  maxBytes = 4 * 1024 * 1024,
  onTooLarge,
}: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handle = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > maxBytes) {
      onTooLarge?.();
      return;
    }
    onPickFile(file);
  };

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handle(file);
      }}
      className={`relative inline-block group cursor-pointer ${
        dragOver ? "ring-4 ring-primary/40 rounded-full" : ""
      }`}
      title="Сурет таңдау немесе бұл жерге сүйреп әкеліңіз"
    >
      <Avatar url={url} name={name} size={size} />
      <span
        className={`absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70 transition-opacity rounded-full ${
          dragOver || busy ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {busy ? (
          <Loader2 size={size * 0.22} strokeWidth={1.4} className="animate-spin text-foreground" />
        ) : dragOver ? (
          <Upload size={size * 0.2} strokeWidth={1.6} className="text-primary" />
        ) : (
          <Camera size={size * 0.2} strokeWidth={1.4} className="text-foreground" />
        )}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handle(file);
        }}
        disabled={busy}
      />
    </label>
  );
};

export default AvatarUploadButton;
