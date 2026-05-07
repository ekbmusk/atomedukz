import { motion } from "framer-motion";
import {
  Flame,
  Trophy,
  Star,
  Beaker,
  Target,
  Award,
  Sparkles,
} from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import type { BadgeId } from "@/hooks/useStudentProgress";

interface Props {
  streakDays: number;
  badges: BadgeId[];
}

const BADGE_ICONS: Record<BadgeId["id"], React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  first_problem: Star,
  ten_problems: Target,
  fifty_problems: Trophy,
  first_lab: Beaker,
  perfect_lab: Award,
  topic_complete: Sparkles,
  ai_curious: Sparkles,
  streak_3: Flame,
  streak_7: Flame,
};

/**
 * Streak counter (days in a row with activity) + earned-badge wall. All
 * derived state from `useStudentProgress` — no DB writes, recomputed on
 * every fetch. Self-paced gamification: about your own milestones, not
 * peer comparison.
 */
const StreakBadges = ({ streakDays, badges }: Props) => {
  const { t } = useLang();
  const tBadges = t.profile.badges;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="label-mono">{tBadges.title}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Streak hero */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-px bg-border">
        <div className="col-span-1 md:col-span-4 bg-background p-5 flex items-center gap-4">
          <Flame
            size={28}
            strokeWidth={1.6}
            className={streakDays > 0 ? "text-primary" : "text-muted-foreground/40"}
          />
          <div>
            <div className="font-display tabular text-4xl leading-none text-foreground">
              {streakDays}
            </div>
            <div className="label-mono text-[10px] text-muted-foreground mt-1">
              {tBadges.streakLabel}
            </div>
          </div>
        </div>

        {/* Badge cells — earned ones bright, locked ones muted */}
        <div className="col-span-1 md:col-span-8 bg-background p-5">
          {badges.length === 0 ? (
            <div className="label-mono text-[10px] text-muted-foreground text-center py-6">
              {tBadges.empty}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {badges.map((b, i) => {
                const Icon = BADGE_ICONS[b.id];
                return (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="flex flex-col items-center text-center gap-1.5"
                    title={tBadges[b.id]}
                  >
                    <span className="w-12 h-12 border border-primary/40 bg-primary/5 flex items-center justify-center text-primary">
                      <Icon size={18} strokeWidth={1.6} />
                    </span>
                    <span className="label-mono text-[9px] text-foreground/80 leading-tight line-clamp-2">
                      {tBadges[b.id]}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default StreakBadges;
