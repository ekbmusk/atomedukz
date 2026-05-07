import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, FileDown, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import LabContent from "@/components/topic/LabContent";
import { TopicPhetContext } from "@/components/topic/PhetInlineEmbed";
import {
  LabFormDataContext,
  checkCellAnswer,
  type LabTableState,
  type LabQuestionState,
  type LabTableExpected,
} from "@/components/topic/LabTable";
import {
  getLabFileSignedUrl,
  useReviewLab,
  type PendingLabSubmission,
} from "@/hooks/useTeacherDashboard";

const LabReviewCard = ({ submission }: { submission: PendingLabSubmission }) => {
  const { t } = useLang();
  const { user } = useAuth();
  const [score, setScore] = useState<string>(submission.score?.toString() ?? "");
  const [comment, setComment] = useState(submission.teacher_comment ?? "");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const reviewMutation = useReviewLab();
  const ref = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [showLabBody, setShowLabBody] = useState(false);

  useEffect(() => {
    if (focusId === submission.id && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusId, submission.id]);

  // Pull captured tables / questions out of the JSONB blob so we can wire
  // them into a read-only `LabContent` render below. The student's writeup
  // shows up in their original lab layout, with their values in place.
  const captured = (submission.data ?? {}) as {
    tables?: LabTableState;
    questions?: LabQuestionState;
  };
  const expected = (submission.lab_expected_results as { tables?: LabTableExpected } | null)?.tables ?? null;

  const labFormApi = useMemo(
    () => ({
      tables: captured.tables ?? {},
      questions: captured.questions ?? {},
      expected,
      setCell: () => {},
      setQuestion: () => {},
      readOnly: true,
    }),
    // captured changes only when submission.data does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submission.data, submission.lab_expected_results],
  );

  // Auto-grade: count cells that match the teacher's expected values.
  const autoGrade = useMemo(() => {
    if (!expected || !captured.tables) return null;
    let total = 0;
    let correct = 0;
    for (const [tableKey, cells] of Object.entries(expected)) {
      for (const [cellKey, spec] of Object.entries(cells)) {
        total++;
        const studentValue = captured.tables?.[tableKey]?.[cellKey];
        if (checkCellAnswer(studentValue, spec)) correct++;
      }
    }
    return total > 0 ? { correct, total, percent: Math.round((100 * correct) / total) } : null;
  }, [expected, captured.tables]);
  const hasCaptured =
    Object.keys(captured.tables ?? {}).length > 0 ||
    Object.values(captured.questions ?? {}).some((v) => v && v.trim().length > 0);

  useEffect(() => {
    let active = true;
    setSignedUrl(null);
    if (submission.report_file_url) {
      getLabFileSignedUrl(submission.report_file_url).then((u) => {
        if (active) setSignedUrl(u);
      });
    }
    return () => {
      active = false;
    };
  }, [submission.report_file_url]);

  const submit = async () => {
    if (!user) return;
    const numScore = parseInt(score, 10);
    if (Number.isNaN(numScore) || numScore < 0 || numScore > 100) {
      toast.error("0-100");
      return;
    }
    try {
      await reviewMutation.mutateAsync({
        submissionId: submission.id,
        score: numScore,
        teacherComment: comment.trim() || null,
        reviewerId: user.id,
      });
      toast.success(t.dashboard.saved);
    } catch {
      toast.error(t.dashboard.saveError);
    }
  };

  const isReviewed = submission.score !== null;

  return (
    <motion.div
      ref={ref}
      id={submission.id}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`border bg-background transition-colors ${
        focusId === submission.id ? "border-primary" : "border-border"
      }`}
    >
      {/* Header */}
      <div className="border-b border-border px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="label-mono text-[10px] tabular text-muted-foreground">
            {t.dashboard.weekShort}{String(submission.week_number).padStart(2, "0")}
          </span>
          <span className="h-3 w-px bg-border" aria-hidden />
          <span className="font-display text-sm text-foreground truncate">{submission.student_name}</span>
        </div>
        <span className="label-mono text-[10px] text-muted-foreground tabular">
          {new Date(submission.submitted_at).toLocaleString("kk-KZ")}
        </span>
      </div>

      {/* Lab title */}
      <div className="px-5 py-3 border-b border-border">
        <span className="label-mono text-[10px] text-muted-foreground mb-1 block">{t.dashboard.topicLabel}</span>
        <p className="text-sm text-foreground/90 font-light">{submission.lab_title}</p>
      </div>

      {/* Report text */}
      {submission.report_text && (
        <div className="px-5 py-4 border-b border-border bg-card/30">
          <span className="label-mono text-[10px] text-muted-foreground mb-2 block">{t.dashboard.report}</span>
          <pre className="text-sm font-light whitespace-pre-wrap text-foreground/90 font-body leading-relaxed max-h-[280px] overflow-y-auto">
            {submission.report_text}
          </pre>
        </div>
      )}

      {/* File link */}
      {submission.report_file_url && (
        <div className="px-5 py-3 border-b border-border">
          <span className="label-mono text-[10px] text-muted-foreground mb-2 block">{t.dashboard.file}</span>
          {signedUrl ? (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 label-mono text-[10px] text-foreground border border-border hover:border-primary hover:text-primary px-3 py-2 transition-colors"
            >
              <FileDown size={12} strokeWidth={1.4} />
              {submission.report_file_url.split("/").pop()}
            </a>
          ) : (
            <span className="label-mono text-[10px] text-muted-foreground">
              <Loader2 size={11} className="inline animate-spin mr-1" />
              …
            </span>
          )}
        </div>
      )}

      {/* Captured table values + question answers from the student. */}
      {hasCaptured && (
        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setShowLabBody((v) => !v)}
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-card/40 transition-colors text-left"
          >
            <span className="label-mono text-[10px] text-primary">СТУДЕНТ ЖАУАПТАРЫ</span>
            <span className="label-mono text-[10px] text-muted-foreground tabular">
              {Object.keys(captured.tables ?? {}).length > 0 && "кесте"}
              {Object.keys(captured.tables ?? {}).length > 0 &&
                Object.values(captured.questions ?? {}).some((v) => v && v.trim()) &&
                " · "}
              {Object.values(captured.questions ?? {}).some((v) => v && v.trim()) &&
                `${Object.values(captured.questions ?? {}).filter((v) => v && v.trim()).length} жауап`}
            </span>
            {autoGrade && (
              <span
                className={`ml-auto label-mono text-[10px] tabular px-2 py-0.5 border ${
                  autoGrade.percent >= 70
                    ? "border-primary/40 text-primary"
                    : "border-border text-muted-foreground"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setScore(String(autoGrade.percent));
                  toast.success(t.dashboard.autoGradeApply);
                }}
                role="button"
                title={t.dashboard.autoGradeApply}
              >
                {autoGrade.correct}/{autoGrade.total} · {autoGrade.percent}
              </span>
            )}
            <ChevronDown
              size={14}
              strokeWidth={1.4}
              className={`${autoGrade ? "" : "ml-auto"} text-muted-foreground transition-transform ${showLabBody ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {showLabBody && (
              <motion.div
                key="body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-5 py-4 bg-background">
                  {submission.lab_theory_kz ? (
                    <TopicPhetContext.Provider
                      value={{ defaultSimId: submission.default_phet_sim_id }}
                    >
                      <LabFormDataContext.Provider value={labFormApi}>
                        <LabContent markdown={submission.lab_theory_kz} />
                      </LabFormDataContext.Provider>
                    </TopicPhetContext.Provider>
                  ) : (
                    <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                      {JSON.stringify(submission.data, null, 2)}
                    </pre>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Grade form */}
      <div className="px-5 py-4 space-y-3">
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-3">
            <label className="label-mono text-[10px] text-muted-foreground block mb-1.5">
              {t.dashboard.grade}
            </label>
            <div className="flex items-baseline gap-1">
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="0"
                className="w-full bg-background border border-border focus:border-primary outline-none px-3 py-2 text-base font-display tabular font-semibold transition-colors"
              />
              <span className="label-mono text-[10px] text-muted-foreground">{t.dashboard.score100}</span>
            </div>
          </div>
          <div className="col-span-9">
            <label className="label-mono text-[10px] text-muted-foreground block mb-1.5">
              {t.dashboard.teacherComment}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t.dashboard.teacherCommentPlaceholder}
              rows={2}
              className="w-full bg-background border border-border focus:border-primary outline-none p-3 text-sm font-light placeholder:text-muted-foreground/40 transition-colors resize-y font-body"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {isReviewed && (
            <span className="label-mono text-[10px] text-muted-foreground">
              {t.dashboard.reviewed} · {submission.reviewed_at ? new Date(submission.reviewed_at).toLocaleString("kk-KZ") : ""}
            </span>
          )}
          <button
            onClick={submit}
            disabled={reviewMutation.isPending || score === ""}
            className="ml-auto inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 label-mono text-[10px] px-4 py-2 transition-colors disabled:opacity-50"
          >
            {reviewMutation.isPending ? (
              <Loader2 size={11} strokeWidth={1.6} className="animate-spin" />
            ) : (
              <Check size={11} strokeWidth={1.8} />
            )}
            {t.dashboard.saveComment}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default LabReviewCard;
