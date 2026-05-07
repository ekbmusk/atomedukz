import { motion } from "framer-motion";
import { ReactNode } from "react";

/**
 * Custom branded icon containers with unique shapes, gradients, and layered compositions.
 * Each icon is a mini-illustration, not a plain Lucide icon.
 */

interface IconShellProps {
  children: ReactNode;
  gradient: string;
  glow?: string;
  size?: number;
  className?: string;
  animate?: boolean;
}

/** Hexagonal icon shell with gradient and glow */
export const HexIcon = ({ children, gradient, glow, size = 64, className = "", animate = true }: IconShellProps) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    {glow && <div className={`absolute inset-0 rounded-2xl ${glow} blur-xl opacity-40 scale-110`} />}
    <motion.div
      className={`relative w-full h-full rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}
      style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
      whileHover={animate ? { scale: 1.08, rotate: 5 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  </div>
);

/** Diamond-rotated icon shell */
export const DiamondIcon = ({ children, gradient, glow, size = 56, className = "" }: IconShellProps) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    {glow && <div className={`absolute inset-1 ${glow} blur-lg opacity-30 rotate-45 rounded-xl`} />}
    <motion.div
      className={`relative w-full h-full rotate-45 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}
      whileHover={{ scale: 1.1, rotate: 50 }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      <div className="relative z-10 -rotate-45">{children}</div>
    </motion.div>
  </div>
);

/** Circular icon with orbital ring animation */
export const OrbitalIcon = ({ children, gradient, glow, size = 64, className = "" }: IconShellProps) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    {glow && <div className={`absolute inset-0 rounded-full ${glow} blur-xl opacity-30 scale-125`} />}
    <div className={`relative w-full h-full rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
      <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent rounded-full" />
      <div className="relative z-10">{children}</div>
    </div>
    {/* Orbital ring */}
    <motion.div
      className="absolute inset-[-4px] rounded-full border border-dashed border-white/10"
      animate={{ rotate: 360 }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    />
    {/* Orbiting dot */}
    <motion.div
      className="absolute w-2 h-2 rounded-full bg-white/40"
      style={{ top: -4, left: "50%", marginLeft: -4 }}
      animate={{ rotate: 360 }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      //@ts-expect-error transformOrigin with px values
      style={{ transformOrigin: `${size / 2}px ${size / 2 + 4}px` }}
    />
  </div>
);

/** Pill/stadium icon shell — wide and low */
export const PillIcon = ({ children, gradient, glow, className = "" }: Omit<IconShellProps, "size">) => (
  <div className={`relative ${className}`}>
    {glow && <div className={`absolute inset-0 ${glow} blur-lg opacity-30 rounded-full`} />}
    <motion.div
      className={`relative px-5 py-3 rounded-full bg-gradient-to-r ${gradient} flex items-center gap-2`}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent rounded-full" />
      <div className="relative z-10 flex items-center gap-2">{children}</div>
    </motion.div>
  </div>
);

/** Layered icon — main icon with a smaller accent icon overlapping */
export const LayeredIcon = ({
  main,
  accent,
  gradient,
  accentGradient,
  glow,
  size = 64,
  className = "",
}: {
  main: ReactNode;
  accent: ReactNode;
  gradient: string;
  accentGradient: string;
  glow?: string;
  size?: number;
  className?: string;
}) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    {glow && <div className={`absolute inset-0 ${glow} blur-xl opacity-30 rounded-2xl scale-110`} />}
    <motion.div
      className={`relative w-full h-full rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center`}
      whileHover={{ scale: 1.06 }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl" />
      <div className="relative z-10">{main}</div>
    </motion.div>
    <motion.div
      className={`absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-gradient-to-br ${accentGradient} flex items-center justify-center shadow-lg border-2 border-background`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", delay: 0.3 }}
    >
      {accent}
    </motion.div>
  </div>
);

/** Glowing blob icon — organic shape with animated morph */
export const BlobIcon = ({ children, gradient, glow, size = 64, className = "" }: IconShellProps) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    {glow && <div className={`absolute inset-0 ${glow} blur-2xl opacity-25 scale-125`} />}
    <motion.div
      className={`relative w-full h-full flex items-center justify-center`}
      animate={{
        borderRadius: [
          "30% 70% 70% 30% / 30% 30% 70% 70%",
          "50% 50% 30% 70% / 60% 40% 60% 40%",
          "30% 70% 70% 30% / 30% 30% 70% 70%",
        ],
      }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}
        style={{
          borderRadius: "inherit",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" style={{ borderRadius: "inherit" }} />
      <div className="relative z-10">{children}</div>
    </motion.div>
  </div>
);
