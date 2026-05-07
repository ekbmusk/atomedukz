import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import MathText from "@/components/MathText";
import {
  useAiHint,
  QuotaExceededError,
  type HintLevel,
  type HintResult,
} from "@/hooks/useAiHint";

const LEVEL_ROMAN: Record<HintLevel, string> = { 1: "I", 2: "II", 3: "III" };
const MAX_LEVEL: HintLevel = 3;

interface Props {
  problemId: string;
}

/**
 * Per-problem AI tutor panel. The student clicks "Көмек сұрау" → the hook
 * calls our `ai-hint` Edge Function, which talks to Claude. Subsequent
 * clicks raise the hint level (I → II → III); the panel shows the full
 * accumulated history so the student can read the prior steps without
 * losing context.
 *
 * State is purely local — closing/reopening the parent problem row keeps
 * the hints visible until the page reloads. Nothing is read from the
 * `ai_hints` table on render (it exists only as audit + quota source).
 */
const ProblemHint = ({ problemId }: Props) => {
  const { t } = useLang();
  const { user } = useAuth();
  const mut = useAiHint();
  const [hints, setHints] = useState<HintResult[]>([]);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const nextLevel = (hints[hints.length - 1]?.level ?? 0) + 1;
  const reachedTop = nextLevel > MAX_LEVEL;
  const remainingToday = hints.length > 0 ? hints[hints.length - 1].remaining_today : null;

  const handleAsk = async () => {
    if (!user) {
      toast.error(t.problems.loginRequired);
      return;
    }
    if (reachedTop || quotaExhausted) return;
    setErrorMsg(null);
    try {
      const res = await mut.mutateAsync({ problemId, level: nextLevel as HintLevel });
      setHints((prev) => [...prev, res]);
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setQuotaExhausted(true);
        toast.error(t.problems.hintExhausted);
        return;
      }
      const code = (err as Error).message;
      const human =
        code === "MISSING_API_KEY"
          ? t.problems.hintMissingKey
          : code === "PROBLEM_NOT_FOUND"
            ? t.problems.hintError
            : t.problems.hintError;
      setErrorMsg(human);
      toast.error(human);
    }
  };

  const buttonLabel = hints.length === 0 ? t.problems.askHint : t.problems.askHintMore;
  const showButton = !reachedTop && !quotaExhausted;

  return (
    <div className="border border-primary/20 bg-primary/5 p-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={13} strokeWidth={1.6} className="text-primary" />
        <span className="label-mono text-[10px] text-primary">AI КӨМЕК</span>
        {remainingToday != null && (
          <span className="ml-auto label-mono text-[10px] text-muted-foreground tabular">
            {t.problems.hintRemaining.replace("{n}", String(remainingToday))}
          </span>
        )}
      </div>

      {/* Accumulated hints */}
      <AnimatePresence initial={false}>
        {hints.map((h) => (
          <motion.div
            key={h.level}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden mb-3 last:mb-0"
          >
            <div className="border-l-2 border-primary/40 pl-3 py-1">
              <span className="label-mono text-[10px] text-primary tabular block mb-1">
                {t.problems.hintLevelLabel.replace("{n}", LEVEL_ROMAN[h.level])}
              </span>
              <div className="text-sm font-light text-foreground/90 leading-relaxed">
                <MathText>{h.hint}</MathText>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Error banner */}
      {errorMsg && (
        <div className="text-[11px] text-destructive inline-flex items-center gap-1.5 mb-2">
          <AlertCircle size={11} strokeWidth={1.6} />
          {errorMsg}
        </div>
      )}

      {/* Quota exhausted */}
      {quotaExhausted && (
        <div className="label-mono text-[10px] text-muted-foreground">
          {t.problems.hintExhausted}
        </div>
      )}

      {/* CTA */}
      {showButton && (
        <button
          type="button"
          onClick={handleAsk}
          disabled={mut.isPending}
          className="inline-flex items-center gap-2 border border-primary/40 hover:border-primary hover:bg-primary hover:text-primary-foreground label-mono text-[10px] px-3 py-2 transition-colors disabled:opacity-50"
        >
          {mut.isPending ? (
            <>
              <Loader2 size={11} strokeWidth={1.6} className="animate-spin" />
              {t.problems.hintLoading}
            </>
          ) : (
            <>
              <Sparkles size={11} strokeWidth={1.6} />
              {buttonLabel}
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default ProblemHint;
