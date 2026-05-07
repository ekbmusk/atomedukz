import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import MathText from "@/components/MathText";
import {
  useReviewProblemAttempt,
  type PendingProblemAttempt,
} from "@/hooks/useTeacherDashboard";

const ROMAN = ["", "I", "II", "III"];

const formatTime = (s: number | null) => {
  if (s == null) return "—";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

const ProblemReviewCard = ({ attempt }: { attempt: PendingProblemAttempt }) => {
  const { t } = useLang();
  const { user } = useAuth();
  const [comment, setComment] = useState(attempt.teacher_comment ?? "");
  const reviewMutation = useReviewProblemAttempt();
  const ref = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");

  useEffect(() => {
    if (focusId === attempt.id && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusId, attempt.id]);

  const review = async (isCorrect: boolean) => {
    if (!user) return;
    try {
      await reviewMutation.mutateAsync({
        attemptId: attempt.id,
        isCorrect,
        teacherComment: comment.trim() || null,
        reviewerId: user.id,
      });
      toast.success(t.dashboard.saved);
    } catch {
      toast.error(t.dashboard.saveError);
    }
  };

  const isReviewed = attempt.is_correct !== null;

  return (
    <motion.div
      ref={ref}
      id={attempt.id}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`border bg-background transition-colors ${
        focusId === attempt.id ? "border-primary" : "border-border"
      }`}
    >
      {/* Header strip — student + topic + difficulty */}
      <div className="border-b border-border px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="label-mono text-[10px] tabular text-muted-foreground">
            {t.dashboard.weekShort}{String(attempt.week_number).padStart(2, "0")}
          </span>
          <span className="h-3 w-px bg-border" aria-hidden />
          <span className="font-display text-sm text-foreground truncate">{attempt.student_name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {attempt.disputed && (
            <span className="label-mono text-[10px] text-destructive border border-destructive/40 px-2 py-0.5">
              {t.dashboard.disputedBadge}
            </span>
          )}
          <span className="label-mono text-[10px] text-primary">{ROMAN[attempt.difficulty]}</span>
          <span className="label-mono text-[10px] text-muted-foreground tabular">
            {formatTime(attempt.time_spent_seconds)}
          </span>
          <span className="label-mono text-[10px] text-muted-foreground tabular">
            {new Date(attempt.created_at).toLocaleString("kk-KZ")}
          </span>
        </div>
      </div>

      {/* Problem text */}
      <div className="px-5 py-4 border-b border-border">
        <span className="label-mono text-[10px] text-muted-foreground mb-2 block">{t.dashboard.topicLabel}</span>
        <div className="text-sm font-light text-foreground/90 leading-relaxed line-clamp-3">
          <MathText>{attempt.problem_text}</MathText>
        </div>
      </div>

      {/* Student answer */}
      <div className="px-5 py-4 border-b border-border bg-card/30">
        <span className="label-mono text-[10px] text-muted-foreground mb-2 block">{t.dashboard.answer}</span>
        <pre className="text-sm font-light whitespace-pre-wrap text-foreground/90 font-body leading-relaxed">
          {attempt.given_answer}
        </pre>
      </div>

      {/* Teacher comment + actions */}
      <div className="px-5 py-4 space-y-3">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t.dashboard.teacherCommentPlaceholder}
          rows={2}
          className="w-full bg-background border border-border focus:border-primary outline-none p-3 text-sm font-light placeholder:text-muted-foreground/40 transition-colors resize-y font-body"
        />
        <div className="flex items-center justify-between gap-2">
          {isReviewed && (
            <span className="label-mono text-[10px] text-muted-foreground">
              {t.dashboard.reviewed} · {attempt.reviewed_at ? new Date(attempt.reviewed_at).toLocaleString("kk-KZ") : ""}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => review(false)}
              disabled={reviewMutation.isPending}
              className="inline-flex items-center gap-2 border border-border hover:border-destructive hover:text-destructive label-mono text-[10px] px-3 py-2 transition-colors disabled:opacity-50"
            >
              <AlertCircle size={11} strokeWidth={1.6} />
              {t.dashboard.markIncorrect}
            </button>
            <button
              onClick={() => review(true)}
              disabled={reviewMutation.isPending}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 label-mono text-[10px] px-3 py-2 transition-colors disabled:opacity-50"
            >
              {reviewMutation.isPending ? (
                <Loader2 size={11} strokeWidth={1.6} className="animate-spin" />
              ) : (
                <Check size={11} strokeWidth={1.8} />
              )}
              {t.dashboard.markCorrect}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProblemReviewCard;
