import { Check } from "lucide-react";

export interface AvatarPreset {
  id: string;
  /** Public path served from /public/avatars/ — works as avatar_url. */
  url: string;
  /** Localized human label. */
  label: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "orbital",  url: "/avatars/preset-orbital.svg",  label: "Орбитал" },
  { id: "bohr",     url: "/avatars/preset-bohr.svg",     label: "Бор" },
  { id: "water",    url: "/avatars/preset-water.svg",    label: "H₂O" },
  { id: "spectrum", url: "/avatars/preset-spectrum.svg", label: "Спектр" },
  { id: "wave",     url: "/avatars/preset-wave.svg",     label: "Толқын" },
  { id: "nucleus",  url: "/avatars/preset-nucleus.svg",  label: "Ядро" },
];

interface Props {
  /** Currently selected avatar URL. Used to highlight which preset
   *  the student already has, if any. */
  selected: string | null | undefined;
  onPick: (url: string) => void;
  /** Disable interaction while the parent is mid-save. */
  disabled?: boolean;
}

const AvatarPresetPicker = ({ selected, onPick, disabled = false }: Props) => {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {AVATAR_PRESETS.map((p) => {
        const isSelected = (selected ?? "").includes(p.url);
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(p.url)}
            title={p.label}
            className={`relative aspect-square overflow-hidden rounded-full border transition-all disabled:opacity-50 ${
              isSelected
                ? "border-primary ring-2 ring-primary/40"
                : "border-border hover:border-foreground/60"
            }`}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
            {isSelected && (
              <span className="absolute inset-0 flex items-center justify-center bg-primary/30">
                <Check size={16} strokeWidth={2.4} className="text-primary-foreground" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default AvatarPresetPicker;
