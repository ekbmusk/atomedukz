import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import MathText from "@/components/MathText";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useSubmitAttempt } from "@/hooks/useProblemAttempts";
import { useSubmitQuiz, type QuizLevel, type QuizPerQuestion } from "@/hooks/useQuiz";
import type { Problem } from "@/hooks/useTopic";

const QUIZ_SIZE = 5;

interface Props {
  topicId: string;
  level: QuizLevel;
  /** All problems of the chosen difficulty for the topic — we draw
   *  QUIZ_SIZE random ones from this. */
  problems: Problem[];
  onClose: () => void;
}

/** Picks N distinct random items, or all of them if fewer than N exist. */
function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

const QuizPlayer = ({ topicId, level, problems, onClose }: Props) => {
  const { t } = useLang();
  const { user } = useAuth();
  const submitAttempt = useSubmitAttempt();
  const submitQuiz = useSubmitQuiz();
  const startedAt = useRef<number>(Date.now());

  // Selection is stable across re-renders for one quiz session. A fresh
  // selection happens on the "Қайта тапсыру" button.
  const [seed, setSeed] = useState(0);
  const selected = useMemo(
    () => pickRandom(problems, QUIZ_SIZE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [problems, seed],
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<QuizPerQuestion[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset the timer when seed changes (i.e. user retakes the quiz).
  useEffect(() => {
    startedAt.current = Date.now();
    setAnswers({});
    setResults(null);
  }, [seed]);

  const submit = async () => {
    if (!user) return;
    if (selected.some((p) => !answers[p.id]?.trim())) {
      toast.error(t.quiz.fillAll);
      return;
    }
    setSubmitting(true);
    try {
      // Grade each answer through the existing server-side auto-grader.
      // This double-purposes: (a) we get a verdict without ever exposing
      // expected_answer to the client, and (b) the answers also count
      // toward the student's regular per-topic progress.
      const elapsedTotal = Math.round((Date.now() - startedAt.current) / 1000);
      const perPiece: QuizPerQuestion[] = [];
      for (const p of selected) {
        const ans = answers[p.id]!.trim();
        const res = await submitAttempt.mutateAsync({
          problemId: p.id,
          topicId,
          userId: user.id,
          givenAnswer: ans,
          timeSpentSeconds: Math.round(elapsedTotal / selected.length),
        });
        perPiece.push({
          problem_id: p.id,
          given: ans,
          correct: res.is_correct,
          time_s: Math.round(elapsedTotal / selected.length),
        });
      }

      const summary = await submitQuiz.mutateAsync({
        topicId,
        userId: user.id,
        level,
        perQuestion: perPiece,
      });

      setResults(perPiece);
      if (summary.score >= 70) {
        toast.success(t.quiz.passed.replace("{score}", String(summary.score)));
      } else {
        toast.error(t.quiz.failed.replace("{score}", String(summary.score)));
      }
    } catch (err) {
      console.error("quiz submit failed", err);
      toast.error(t.problems.saveError);
    } finally {
      setSubmitting(false);
    }
  };

  const retake = () => setSeed((s) => s + 1);

  if (selected.length === 0) {
    return (
      <div className="border border-border p-12 text-center">
        <p className="label-mono text-[11px] text-muted-foreground">{t.quiz.notEnough}</p>
        <button onClick={onClose} className="mt-4 label-mono text-[10px] text-primary hover:underline">
          ← {t.quiz.back}
        </button>
      </div>
    );
  }

  // Results view
  if (results) {
    const correctCount = results.filter((r) => r.correct === true).length;
    const totalCount = results.length;
    const percent = Math.round((100 * correctCount) / totalCount);
    const passed = percent >= 70;

    return (
      <div className="space-y-5">
        <div className={`border ${passed ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"} px-5 py-6`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <span className="label-mono text-[10px] text-muted-foreground">
                {t.quiz.resultsLabel}
              </span>
              <div className="font-display tabular text-5xl text-foreground leading-none mt-1">
                {percent}
                <span className="text-muted-foreground/50 text-2xl">/100</span>
              </div>
              <div className="mt-2 label-mono text-[10px] text-muted-foreground">
                {correctCount} / {totalCount} · {passed ? t.quiz.passShort : t.quiz.failShort}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={retake}
                className="inline-flex items-center gap-2 border border-border hover:border-foreground label-mono text-[10px] px-4 py-2 transition-colors"
              >
                <RefreshCw size={11} strokeWidth={1.6} />
                {t.quiz.retake}
              </button>
              <button
                onClick={onClose}
                className="bg-primary text-primary-foreground hover:bg-primary/90 label-mono text-[10px] px-4 py-2 transition-colors"
              >
                {t.quiz.done}
              </button>
            </div>
          </div>
        </div>

        {/* Per-question breakdown */}
        <div className="border border-border divide-y divide-border">
          {selected.map((p, i) => {
            const r = results[i];
            const ok = r?.correct === true;
            const pending = r?.correct == null;
            return (
              <div key={p.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="label-mono text-[10px] tabular text-muted-foreground mt-1">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground/85 font-light leading-relaxed">
                      <MathText>{p.problem_text_kz}</MathText>
                    </div>
                    <div className="mt-2 label-mono text-[10px] text-muted-foreground">
                      {t.quiz.yourAnswer}: <span className="text-foreground/80">{r?.given}</span>
                    </div>
                  </div>
                  <span className="shrink-0 mt-1">
                    {ok ? (
                      <Check size={14} strokeWidth={2} className="text-primary" />
                    ) : pending ? (
                      <span className="label-mono text-[10px] text-muted-foreground">{t.quiz.pending}</span>
                    ) : (
                      <AlertCircle size={14} strokeWidth={2} className="text-destructive" />
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Active quiz view
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <span className="label-mono text-[10px] text-muted-foreground">{t.quiz.inProgress}</span>
          <div className="font-display text-lg text-foreground">
            {selected.length} {t.quiz.questionsCount}
          </div>
        </div>
        <button
          onClick={onClose}
          className="label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {t.quiz.back}
        </button>
      </div>

      <div className="space-y-4">
        {selected.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 * i }}
            className="border border-border px-5 py-4"
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="label-mono text-[10px] tabular text-muted-foreground mt-1">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0 text-sm text-foreground/85 font-light leading-relaxed">
                <MathText>{p.problem_text_kz}</MathText>
              </div>
            </div>
            <input
              type="text"
              value={answers[p.id] ?? ""}
              onChange={(e) => setAnswers((s) => ({ ...s, [p.id]: e.target.value }))}
              placeholder={t.problems.answerPlaceholder}
              className="w-full bg-background border border-border focus:border-primary outline-none px-3 py-2 text-sm font-light placeholder:text-muted-foreground/40 transition-colors font-body"
            />
          </motion.div>
        ))}
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={submit}
          disabled={submitting}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 label-mono text-[10px] px-5 py-2.5 transition-colors disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 size={12} strokeWidth={1.6} className="animate-spin" />
          ) : (
            <Check size={12} strokeWidth={1.8} />
          )}
          {submitting ? t.quiz.submitting : t.quiz.submit}
        </button>
      </div>
    </div>
  );
};

export default QuizPlayer;
