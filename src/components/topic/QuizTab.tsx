import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Lock, ChevronRight, Sparkles } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useTopicQuizzes, type QuizLevel } from "@/hooks/useQuiz";
import QuizPlayer from "@/components/topic/QuizPlayer";
import type { Problem } from "@/hooks/useTopic";

const PASS_THRESHOLD = 70;

const LEVEL_LABEL_KEYS = {
  1: "levelEasy",
  2: "levelMedium",
  3: "levelHard",
} as const;

const LEVEL_ROMAN = { 1: "I", 2: "II", 3: "III" } as const;

interface Props {
  topicId: string;
  problems: Problem[];
}

const QuizTab = ({ topicId, problems }: Props) => {
  const { t } = useLang();
  const { user } = useAuth();
  const { data: best } = useTopicQuizzes(topicId, user?.id);
  const [active, setActive] = useState<QuizLevel | null>(null);

  const byLevel: Record<QuizLevel, Problem[]> = { 1: [], 2: [], 3: [] };
  for (const p of problems) {
    if (p.difficulty === 1 || p.difficulty === 2 || p.difficulty === 3) {
      byLevel[p.difficulty as QuizLevel].push(p);
    }
  }

  // Soft-gate: level 2 requires level 1 quiz pass; level 3 requires level
  // 2 pass. Pass = best score >= 70.
  const passed = (lvl: QuizLevel): boolean => (best?.[lvl] ?? 0) >= PASS_THRESHOLD;
  const unlocked = (lvl: QuizLevel): boolean =>
    lvl === 1 ? true : passed((lvl - 1) as QuizLevel);

  if (active != null) {
    return (
      <QuizPlayer
        topicId={topicId}
        level={active}
        problems={byLevel[active]}
        onClose={() => setActive(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="label-mono">{t.quiz.label}</span>
        <div className="flex-1 h-px bg-border" />
        <span className="label-mono text-[10px] text-muted-foreground">{t.quiz.passRule}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
        {([1, 2, 3] as QuizLevel[]).map((lvl, i) => {
          const score = best?.[lvl];
          const passedLvl = passed(lvl);
          const unlockedLvl = unlocked(lvl);
          const count = byLevel[lvl].length;
          return (
            <motion.button
              key={lvl}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 * i }}
              disabled={!unlockedLvl || count === 0}
              onClick={() => setActive(lvl)}
              className={`bg-background p-5 text-left flex flex-col gap-3 transition-colors ${
                unlockedLvl && count > 0
                  ? "hover:bg-card/40 cursor-pointer"
                  : "opacity-60 cursor-not-allowed"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display tabular text-3xl text-primary leading-none">
                  {LEVEL_ROMAN[lvl]}
                </span>
                {!unlockedLvl ? (
                  <Lock size={14} strokeWidth={1.4} className="text-muted-foreground" />
                ) : passedLvl ? (
                  <Trophy size={14} strokeWidth={1.4} className="text-primary" />
                ) : (
                  <Sparkles size={14} strokeWidth={1.4} className="text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="text-sm font-display text-foreground">
                  {t.problems[LEVEL_LABEL_KEYS[lvl]]}
                </div>
                <div className="label-mono text-[10px] text-muted-foreground mt-1 tabular">
                  {count > 0 ? `N=${count}` : t.quiz.notEnough}
                </div>
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="label-mono text-[10px] text-muted-foreground tabular">
                  {score != null ? (
                    <>
                      {t.quiz.bestLabel}:{" "}
                      <span className={passedLvl ? "text-primary" : "text-foreground"}>
                        {score}/100
                      </span>
                    </>
                  ) : !unlockedLvl ? (
                    t.quiz.lockedHint.replace("{prev}", LEVEL_ROMAN[(lvl - 1) as QuizLevel])
                  ) : (
                    t.quiz.notTaken
                  )}
                </span>
                {unlockedLvl && count > 0 && (
                  <ChevronRight size={12} strokeWidth={1.6} className="text-muted-foreground" />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default QuizTab;
