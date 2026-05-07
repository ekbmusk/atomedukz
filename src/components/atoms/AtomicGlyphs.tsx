/**
 * AtomicGlyphs — small decorative SVGs used across the site.
 * All inherit currentColor; size via className width/height.
 *
 * Aesthetic: thin 1px stroke, no fill, scientific drawing feel.
 */

interface GlyphProps {
  className?: string;
  size?: number;
}

/** Bohr-style orbital diagram (3 elliptical orbits + nucleus). Rotating. */
export const Orbital = ({ className = "", size = 240 }: GlyphProps) => (
  <svg
    viewBox="0 0 200 200"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="0.6"
    aria-hidden="true"
  >
    <g style={{ transformOrigin: "100px 100px", animation: "spin 60s linear infinite" }}>
      <ellipse cx="100" cy="100" rx="90" ry="35" />
      <ellipse cx="100" cy="100" rx="90" ry="35" transform="rotate(60 100 100)" />
      <ellipse cx="100" cy="100" rx="90" ry="35" transform="rotate(120 100 100)" />
    </g>
    <circle cx="100" cy="100" r="3" fill="currentColor" stroke="none" />
    <circle cx="190" cy="100" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="55" cy="178" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="55" cy="22" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

/** Concentric Bohr shells (no rotation, decorative) */
export const BohrShells = ({ className = "", size = 200 }: GlyphProps) => (
  <svg
    viewBox="0 0 200 200"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="0.5"
    aria-hidden="true"
  >
    <circle cx="100" cy="100" r="20" />
    <circle cx="100" cy="100" r="42" />
    <circle cx="100" cy="100" r="68" />
    <circle cx="100" cy="100" r="96" strokeDasharray="2 4" />
    <circle cx="100" cy="100" r="2.5" fill="currentColor" stroke="none" />
  </svg>
);

/** Hexagonal molecular bond ring — like benzene */
export const Hex = ({ className = "", size = 64 }: GlyphProps) => (
  <svg
    viewBox="0 0 60 60"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    aria-hidden="true"
  >
    <polygon points="30,4 52,17 52,43 30,56 8,43 8,17" />
  </svg>
);

/** Crosshair / target reticule */
export const Crosshair = ({ className = "", size = 40 }: GlyphProps) => (
  <svg
    viewBox="0 0 40 40"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="0.8"
    aria-hidden="true"
  >
    <circle cx="20" cy="20" r="14" />
    <line x1="20" y1="0" x2="20" y2="8" />
    <line x1="20" y1="32" x2="20" y2="40" />
    <line x1="0" y1="20" x2="8" y2="20" />
    <line x1="32" y1="20" x2="40" y2="20" />
    <circle cx="20" cy="20" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

/** Spectral emission lines — fixed pattern (vertical lines at varying heights) */
export const Spectrum = ({ className = "", height = 56 }: { className?: string; height?: number }) => {
  const lines = [
    { x: 12, h: 0.7, c: "currentColor", a: 0.9 },
    { x: 28, h: 0.4, c: "currentColor", a: 0.5 },
    { x: 56, h: 1.0, c: "currentColor", a: 1.0 },
    { x: 88, h: 0.6, c: "currentColor", a: 0.7 },
    { x: 134, h: 0.85, c: "currentColor", a: 0.8 },
    { x: 178, h: 0.5, c: "currentColor", a: 0.5 },
    { x: 220, h: 0.95, c: "currentColor", a: 0.95 },
    { x: 268, h: 0.45, c: "currentColor", a: 0.5 },
    { x: 310, h: 0.75, c: "currentColor", a: 0.75 },
    { x: 348, h: 0.55, c: "currentColor", a: 0.6 },
    { x: 386, h: 0.9, c: "currentColor", a: 0.85 },
  ];
  return (
    <svg
      viewBox={`0 0 400 ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      style={{ height }}
    >
      <line x1="0" y1={height - 0.5} x2="400" y2={height - 0.5} stroke="currentColor" strokeOpacity="0.2" strokeWidth="0.5" />
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x}
          x2={l.x}
          y1={height * (1 - l.h)}
          y2={height - 1}
          stroke={l.c}
          strokeOpacity={l.a}
          strokeWidth="1"
        />
      ))}
    </svg>
  );
};

/** Tiny "N/M" progress with notches — used in lecture reader */
export const NotchProgress = ({
  current,
  total,
  className = "",
}: {
  current: number;
  total: number;
  className?: string;
}) => {
  const safeTotal = Math.max(total, 1);
  return (
    <div className={`flex items-center gap-[2px] ${className}`}>
      {Array.from({ length: safeTotal }).map((_, i) => (
        <div
          key={i}
          className="h-[3px] flex-1 transition-colors"
          style={{
            backgroundColor:
              i < current
                ? "hsl(var(--primary))"
                : "hsl(var(--foreground) / 0.12)",
            minWidth: 4,
          }}
        />
      ))}
    </div>
  );
};

/** Add CSS animation if not present (consumer must include in global CSS) */
