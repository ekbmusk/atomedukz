import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Clock, AlertCircle, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import MathText from "@/components/MathText";
import ProblemHint from "@/components/topic/ProblemHint";
import { useAiExplain } from "@/hooks/useAiExplain";
import { useAiGradeAnswer, NoExpectedAnswerError } from "@/hooks/useAiGradeAnswer";
import type { Problem } from "@/hooks/useTopic";
import {
  indexLatestByProblem,
  useDisputeAttempt,
  useSubmitAttempt,
  useTopicAttempts,
  type ProblemAttempt,
} from "@/hooks/useProblemAttempts";

interface ProblemsListProps {
  problems: Problem[];
  topicId: string;
}

type Level = 1 | 2 | 3;

const LEVEL_KEYS = {
  1: "levelEasy",
  2: "levelMedium",
  3: "levelHard",
} as const;

const LEVEL_ROMAN = { 1: "I", 2: "II", 3: "III" } as const;

const StatusBadge = ({ attempt }: { attempt: ProblemAttempt | null }) => {
  const { t } = useLang();
  if (!attempt) return null;

  if (attempt.is_correct === true) {
    return (
      <span className="label-mono text-[10px] inline-flex items-center gap-1 text-primary">
        <Check size={10} strokeWidth={1.8} />
        {t.problems.correct}
      </span>
    );
  }
  if (attempt.is_correct === false) {
    return (
      <span className="label-mono text-[10px] inline-flex items-center gap-1 text-destructive">
        <AlertCircle size={10} strokeWidth={1.8} />
        {t.problems.incorrect}
      </span>
    );
  }
  return (
    <span className="label-mono text-[10px] inline-flex items-center gap-1 text-muted-foreground">
      <Clock size={10} strokeWidth={1.8} />
      {t.problems.pending}
    </span>
  );
};

const formatDuration = (seconds: number | null): string => {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
};

const ProblemRow = ({
  problem,
  index,
  attempt,
  topicId,
}: {
  problem: Problem;
  index: number;
  attempt: ProblemAttempt | null;
  topicId: string;
}) => {
  const { t } = useLang();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [solving, setSolving] = useState(false);
  const [answer, setAnswer] = useState("");
  const startedAtRef = useRef<number | null>(null);
  const submitMutation = useSubmitAttempt();

  const text = problem.problem_text_kz;

  // Reset solving form when collapsing
  useEffect(() => {
    if (!open) {
      setSolving(false);
      setAnswer("");
      startedAtRef.current = null;
    }
  }, [open]);

  const startSolving = () => {
    if (!user) {
      toast.error(t.problems.loginRequired);
      return;
    }
    setSolving(true);
    startedAtRef.current = Date.now();
  };

  const disputeMutation = useDisputeAttempt();
  const explainMutation = useAiExplain();
  const aiGradeMutation = useAiGradeAnswer();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationCached, setExplanationCached] = useState(false);
  const [flash, setFlash] = useState<"correct" | "incorrect" | null>(null);
  const [aiGradeNote, setAiGradeNote] = useState<string | null>(null);

  // Reset transient state when the latest attempt changes — a new wrong
  // answer needs its own explanation, the previous one is no longer
  // about *this* attempt.
  useEffect(() => {
    setExplanation(null);
    setExplanationCached(false);
    setAiGradeNote(null);
  }, [attempt?.id]);

  const requestExplanation = async () => {
    if (!attempt || !attempt.given_answer) return;
    try {
      const res = await explainMutation.mutateAsync({
        problemId: problem.id,
        givenAnswer: attempt.given_answer,
      });
      setExplanation(res.explanation);
      setExplanationCached(res.cached);
    } catch {
      toast.error(t.problems.explainError);
    }
  };

  /** Re-grade an existing strict-failed attempt through Groq. Updates
   *  the attempt server-side if the AI says the answer is physically
   *  equivalent to the expected one. */
  const requestAiRecheck = async (attemptId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const res = await aiGradeMutation.mutateAsync({
        attemptId,
        topicId,
        userId: user.id,
      });
      if (res.is_correct) {
        toast.success(t.problems.recheckCorrect);
        setFlash("correct");
        setTimeout(() => setFlash(null), 1100);
      } else {
        setAiGradeNote(res.note || t.problems.recheckIncorrect);
      }
      return res.is_correct;
    } catch (err) {
      if (err instanceof NoExpectedAnswerError) {
        toast.message(t.problems.recheckNoAnswer);
      } else {
        toast.error(t.problems.recheckError);
      }
      return false;
    }
  };

  const submit = async () => {
    if (!user || !answer.trim()) return;
    const elapsed = startedAtRef.current
      ? Math.round((Date.now() - startedAtRef.current) / 1000)
      : null;
    try {
      const res = await submitMutation.mutateAsync({
        problemId: problem.id,
        topicId,
        userId: user.id,
        givenAnswer: answer.trim(),
        timeSpentSeconds: elapsed,
      });
      // Tailor the toast + run a brief celebratory/error flash overlay so
      // the student gets immediate visceral feedback instead of just a
      // toast.
      if (res.auto_graded) {
        if (res.is_correct) {
          toast.success(t.problems.autoCorrect);
          setFlash("correct");
          setTimeout(() => setFlash(null), 1100);
          setSolving(false);
          setAnswer("");
        } else {
          // Strict numeric/string match failed. Show pending toast and
          // ask Groq whether the answer is physically equivalent
          // (handles 1,5e-7 vs 1.5×10⁻⁷, нм vs nm, extra prose, etc).
          // If AI flips it to correct, the attempt row is updated
          // server-side and the next refetch picks it up.
          toast.message(t.problems.aiRecheckRunning);
          setSolving(false);
          setAnswer("");
          const flipped = await requestAiRecheck(res.attempt_id);
          if (!flipped) {
            toast.error(t.problems.autoIncorrect);
            setFlash("incorrect");
            setTimeout(() => setFlash(null), 1100);
          }
        }
      } else {
        toast.success(t.problems.submitted);
        setSolving(false);
        setAnswer("");
      }
    } catch {
      toast.error(t.problems.saveError);
    }
  };

  const dispute = async () => {
    if (!user || !attempt) return;
    try {
      await disputeMutation.mutateAsync({
        attemptId: attempt.id,
        topicId,
        userId: user.id,
      });
      toast.success(t.problems.disputed);
    } catch {
      toast.error(t.problems.saveError);
    }
  };

  return (
    <div className="border-b border-border relative overflow-hidden">
      {/* Auto-grade flash overlay — primary tint sweep on a correct answer,
          destructive sweep on a wrong one. Disappears in 1.1s. */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className={`absolute inset-0 pointer-events-none z-10 ${
              flash === "correct" ? "bg-primary/15" : "bg-destructive/12"
            }`}
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${
                flash === "correct" ? "text-primary" : "text-destructive"
              }`}
            >
              {flash === "correct" ? (
                <Check size={56} strokeWidth={2} />
              ) : (
                <AlertCircle size={56} strokeWidth={2} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left py-5 grid grid-cols-12 gap-4 items-start hover:bg-card/30 transition-colors px-2"
      >
        <span className="col-span-1 label-mono text-[10px] text-muted-foreground tabular pt-[3px]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="col-span-9 flex flex-col gap-1.5">
          <div className={`text-sm text-foreground/85 leading-relaxed font-light ${open ? "" : "line-clamp-2"}`}>
            <MathText block={open}>{text}</MathText>
          </div>
        </div>
        <div className="col-span-2 flex items-center justify-end gap-3 pt-[2px]">
          <StatusBadge attempt={attempt} />
          <ChevronDown
            size={14}
            strokeWidth={1.4}
            className={`text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-6 pt-2 grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-9 md:col-start-2">
                {/* Existing submission display */}
                {attempt && !solving && (
                  <div
                    className={`mb-4 border p-4 ${
                      attempt.is_correct === true
                        ? "border-primary/40 bg-primary/5"
                        : attempt.is_correct === false
                          ? "border-destructive/40 bg-destructive/5"
                          : "border-border bg-card/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="label-mono text-[10px] text-muted-foreground">
                        {t.problems.yourAnswer} · {new Date(attempt.created_at).toLocaleString("kk-KZ")}
                      </span>
                      <span className="label-mono text-[10px] text-muted-foreground tabular">
                        {t.problems.timeSpent}: {formatDuration(attempt.time_spent_seconds)}
                      </span>
                    </div>
                    <pre className="text-sm font-light whitespace-pre-wrap text-foreground/90 font-body">
                      {attempt.given_answer}
                    </pre>
                    {/* Auto-grade outcome + AI explain + dispute button */}
                    {attempt.is_correct === false && !attempt.disputed && (
                      <div className="mt-3 pt-3 border-t border-border space-y-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="label-mono text-[10px] text-destructive">
                            {t.problems.autoIncorrectHint}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => requestAiRecheck(attempt.id)}
                              disabled={aiGradeMutation.isPending}
                              className="inline-flex items-center gap-1.5 border border-foreground/40 text-foreground hover:bg-foreground hover:text-background label-mono text-[10px] px-3 py-1.5 transition-colors disabled:opacity-50"
                            >
                              {aiGradeMutation.isPending ? (
                                <Loader2 size={11} strokeWidth={1.6} className="animate-spin" />
                              ) : (
                                <ShieldCheck size={11} strokeWidth={1.6} />
                              )}
                              {aiGradeMutation.isPending ? t.problems.recheckLoading : t.problems.recheckButton}
                            </button>
                            <button
                              type="button"
                              onClick={requestExplanation}
                              disabled={explainMutation.isPending || Boolean(explanation)}
                              className="inline-flex items-center gap-1.5 border border-primary/40 text-primary hover:bg-primary/5 label-mono text-[10px] px-3 py-1.5 transition-colors disabled:opacity-50"
                            >
                              {explainMutation.isPending ? (
                                <Loader2 size={11} strokeWidth={1.6} className="animate-spin" />
                              ) : (
                                <Sparkles size={11} strokeWidth={1.6} />
                              )}
                              {explainMutation.isPending ? t.problems.explainLoading : t.problems.askExplain}
                            </button>
                            <button
                              type="button"
                              onClick={dispute}
                              disabled={disputeMutation.isPending}
                              className="inline-flex items-center gap-1.5 border border-border hover:border-foreground label-mono text-[10px] px-3 py-1.5 transition-colors disabled:opacity-50"
                            >
                              {disputeMutation.isPending && (
                                <Loader2 size={11} strokeWidth={1.6} className="animate-spin" />
                              )}
                              {t.problems.disputeAction}
                            </button>
                          </div>
                        </div>

                        {aiGradeNote && (
                          <div className="bg-card/40 border border-border px-4 py-3">
                            <div className="label-mono text-[10px] text-muted-foreground inline-flex items-center gap-1.5 mb-1.5">
                              <ShieldCheck size={10} strokeWidth={1.6} />
                              {t.problems.recheckLabel}
                            </div>
                            <p className="text-sm text-foreground/85 font-light leading-relaxed">
                              {aiGradeNote}
                            </p>
                          </div>
                        )}

                        {/* Rendered AI explanation, if requested. KaTeX
                            via MathText for the formula bits. */}
                        {explanation && (
                          <div className="bg-card/40 border border-primary/20 px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="label-mono text-[10px] text-primary inline-flex items-center gap-1.5">
                                <Sparkles size={10} strokeWidth={1.6} />
                                {t.problems.explainLabel}
                              </span>
                              {explanationCached && (
                                <span className="label-mono text-[9px] text-muted-foreground">
                                  ({t.problems.explainCached})
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-foreground/85 font-light leading-relaxed">
                              <MathText block>{explanation}</MathText>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {attempt.disputed && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <span className="label-mono text-[10px] text-primary">
                          {t.problems.disputedBadge}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Solve form */}
                {solving ? (
                  <div className="space-y-3">
                    <label className="label-mono text-[10px] text-muted-foreground block">
                      {t.problems.answerLabel}
                    </label>
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder={t.problems.answerPlaceholder}
                      autoFocus
                      rows={6}
                      className="w-full bg-background border border-border focus:border-primary outline-none p-3 text-sm font-light placeholder:text-muted-foreground/40 transition-colors resize-y font-body leading-relaxed"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSolving(false);
                          setAnswer("");
                        }}
                        className="label-mono text-[10px] text-muted-foreground hover:text-foreground px-3 py-2 transition-colors"
                      >
                        {t.problems.cancel}
                      </button>
                      <button
                        onClick={submit}
                        disabled={submitMutation.isPending || !answer.trim()}
                        className="group inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50 hover:bg-primary/90 transition-colors"
                      >
                        {submitMutation.isPending ? (
                          <>
                            <Loader2 size={12} strokeWidth={1.6} className="animate-spin" />
                            <span className="label-mono text-[10px]">{t.problems.submitting}</span>
                          </>
                        ) : (
                          <span className="label-mono text-[10px]">{t.problems.submit}</span>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={startSolving}
                    className="label-mono text-[10px] text-foreground border border-border hover:border-primary hover:text-primary px-4 py-2 transition-colors"
                  >
                    {attempt ? t.problems.resubmit : t.problems.solve} →
                  </button>
                )}

                {/* AI tutor — accumulates progressive hints, never reveals
                    the final numeric answer. Visible regardless of whether
                    the student is currently solving. */}
                <ProblemHint problemId={problem.id} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LevelSection = ({
  level,
  problems,
  attemptsByProblem,
  topicId,
}: {
  level: Level;
  problems: Problem[];
  attemptsByProblem: Record<string, ProblemAttempt>;
  topicId: string;
}) => {
  const { t } = useLang();
  if (problems.length === 0) return null;

  const solvedCount = problems.filter((p) => attemptsByProblem[p.id] != null).length;

  return (
    <section className="mb-12">
      <div className="flex items-baseline gap-4 mb-3">
        <span className="font-display tabular text-2xl text-primary leading-none">
          {LEVEL_ROMAN[level]}
        </span>
        <span className="label-mono text-foreground">{t.problems[LEVEL_KEYS[level]]}</span>
        <div className="flex-1 h-px bg-border" />
        <span className="label-mono text-[10px] text-muted-foreground tabular">
          {solvedCount}/{problems.length}
        </span>
      </div>
      <div>
        {problems.map((p, i) => (
          <ProblemRow
            key={p.id}
            problem={p}
            index={i}
            attempt={attemptsByProblem[p.id] ?? null}
            topicId={topicId}
          />
        ))}
      </div>
    </section>
  );
};

const ProblemsList = ({ problems, topicId }: ProblemsListProps) => {
  const { t } = useLang();
  const { user } = useAuth();
  const { data: attempts } = useTopicAttempts(topicId, user?.id);

  const attemptsByProblem = useMemo(
    () => indexLatestByProblem(attempts ?? []),
    [attempts],
  );

  if (problems.length === 0) {
    return (
      <div className="border border-border p-12 text-center">
        <p className="label-mono text-[11px] text-muted-foreground">{t.problems.none}</p>
      </div>
    );
  }

  const byLevel: Record<Level, Problem[]> = { 1: [], 2: [], 3: [] };
  for (const p of problems) {
    if (p.difficulty in byLevel) byLevel[p.difficulty as Level].push(p);
  }

  return (
    <div>
      <LevelSection level={1} problems={byLevel[1]} attemptsByProblem={attemptsByProblem} topicId={topicId} />
      <LevelSection level={2} problems={byLevel[2]} attemptsByProblem={attemptsByProblem} topicId={topicId} />
      <LevelSection level={3} problems={byLevel[3]} attemptsByProblem={attemptsByProblem} topicId={topicId} />
    </div>
  );
};

export default ProblemsList;
