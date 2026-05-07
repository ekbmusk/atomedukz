import { useMemo } from "react";

interface Props {
  /** Public URL of the avatar image (or null/undefined for fallback). */
  url?: string | null;
  /** Display name — used to derive the initial fallback. */
  name?: string | null;
  /** Pixel size of the square avatar. */
  size?: number;
  className?: string;
}

/**
 * Square avatar that shows a user's uploaded image when available, falling
 * back to a deterministic two-letter monogram on a tinted background. Used
 * everywhere a user-card needs identity (Navbar, ProfilePage, leaderboard,
 * students table, etc).
 */
const Avatar = ({ url, name, size = 32, className = "" }: Props) => {
  const initials = useMemo(() => deriveInitials(name ?? ""), [name]);
  const tone = useMemo(() => deriveTone(name ?? "anon"), [name]);

  const dim = `${size}px`;
  const fontSize = `${Math.round(size * 0.42)}px`;

  if (url) {
    return (
      <img
        src={url}
        alt={name ?? ""}
        width={size}
        height={size}
        className={`rounded-full object-cover bg-card border border-border ${className}`}
        style={{ width: dim, height: dim }}
        loading="lazy"
      />
    );
  }

  return (
    <span
      aria-label={name ?? ""}
      className={`inline-flex items-center justify-center rounded-full font-display font-semibold tracking-tight uppercase border border-border ${className}`}
      style={{
        width: dim,
        height: dim,
        fontSize,
        background: tone.bg,
        color: tone.fg,
      }}
    >
      {initials}
    </span>
  );
};

function deriveInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "—";
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).slice(0, 2);
}

/**
 * Pick a stable HSL pair from the name so two students don't collide more
 * often than necessary. Uses the project's foreground/background tokens
 * with a hue offset for variety.
 */
function deriveTone(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsl(${hue}, 32%, 24%)`,
    fg: `hsl(${hue}, 24%, 86%)`,
  };
}

export default Avatar;
