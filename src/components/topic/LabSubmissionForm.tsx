import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Paperclip, X, Check, Clock, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import Markdown from "@/components/Markdown";
import LabContent from "@/components/topic/LabContent";
import { TopicPhetContext } from "@/components/topic/PhetInlineEmbed";
import {
  LabFormDataContext,
  type LabTableState,
  type LabQuestionState,
  type LabTableExpected,
} from "@/components/topic/LabTable";
import {
  getLabReportSignedUrl,
  useLabSubmission,
  useSubmitLab,
} from "@/hooks/useLabSubmissions";
import type { Lab } from "@/hooks/useTopic";

interface LabSubmissionFormProps {
  lab: Lab;
  topicId: string;
  /** First sim from the topic's `phet_simulations`, used as the inline
   * simulator target when a procedure step says "open the simulator"
   * without a literal URL. */
  defaultPhetSimId?: string | null;
}

const formatDate = (iso: string) => new Date(iso).toLocaleString("kk-KZ");

const LabSubmissionForm = ({ lab, topicId, defaultPhetSimId = null }: LabSubmissionFormProps) => {
  const { t } = useLang();
  const { user } = useAuth();
  const { data: existing, isLoading } = useLabSubmission(lab.id, user?.id);
  const submitMutation = useSubmitLab();

  const [editing, setEditing] = useState(false);
  const [reportText, setReportText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [tableState, setTableState] = useState<LabTableState>({});
  const [questionState, setQuestionState] = useState<LabQuestionState>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hydrate interactive form state from any existing submission, so the
  // student sees their previous values when they open the lab again.
  useEffect(() => {
    const blob = existing?.data as { tables?: LabTableState; questions?: LabQuestionState } | null;
    setTableState(blob?.tables && typeof blob.tables === "object" ? blob.tables : {});
    setQuestionState(blob?.questions && typeof blob.questions === "object" ? blob.questions : {});
  }, [existing?.id]);

  const expectedAnswers = (lab.expected_results as { tables?: LabTableExpected } | null)?.tables ?? null;

  const formApi = useMemo(
    () => ({
      tables: tableState,
      questions: questionState,
      expected: expectedAnswers,
      setCell: (tableKey: string, cellKey: string, value: string) =>
        setTableState((prev) => ({
          ...prev,
          [tableKey]: { ...(prev[tableKey] ?? {}), [cellKey]: value },
        })),
      setQuestion: (questionKey: string, value: string) =>
        setQuestionState((prev) => ({ ...prev, [questionKey]: value })),
      readOnly: !!existing && !editing,
    }),
    [tableState, questionState, expectedAnswers, existing, editing],
  );

  // Sign existing file URL on demand
  useEffect(() => {
    let active = true;
    setSignedUrl(null);
    if (existing?.report_file_url) {
      getLabReportSignedUrl(existing.report_file_url).then((u) => {
        if (active) setSignedUrl(u);
      });
    }
    return () => {
      active = false;
    };
  }, [existing?.report_file_url]);

  const submit = async () => {
    if (!user || !reportText.trim()) return;
    try {
      const dataPayload: Record<string, unknown> = {};
      if (Object.keys(tableState).length > 0) dataPayload.tables = tableState;
      if (Object.values(questionState).some((v) => v.trim().length > 0)) {
        dataPayload.questions = questionState;
      }
      await submitMutation.mutateAsync({
        labId: lab.id,
        topicId,
        userId: user.id,
        reportText: reportText.trim(),
        file,
        data: Object.keys(dataPayload).length > 0 ? dataPayload : null,
      });
      toast.success(t.lab.submitted);
      setEditing(false);
      setReportText("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "FILE_TOO_LARGE") {
        toast.error(t.lab.fileTooLarge);
      } else {
        toast.error(t.lab.saveError);
      }
    }
  };

  const startEdit = () => {
    if (!user) {
      toast.error(t.lab.loginRequired);
      return;
    }
    setEditing(true);
    setReportText(existing?.report_text ?? "");
    setFile(null);
  };

  // Status badge based on existing submission
  const renderStatus = () => {
    if (!existing) return null;
    const isGraded = existing.score != null && existing.reviewed_at != null;
    return (
      <div className="flex items-center gap-3">
        {isGraded ? (
          <span className="label-mono text-[10px] inline-flex items-center gap-1.5 text-primary">
            <Check size={10} strokeWidth={1.8} />
            {t.lab.graded} · {existing.score}/100
          </span>
        ) : (
          <span className="label-mono text-[10px] inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock size={10} strokeWidth={1.8} />
            {t.lab.pending}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="border border-border bg-background">
      {/* Header */}
      <div className="border-b border-border p-6 md:p-8 flex items-start justify-between gap-4">
        <div>
          <span className="label-mono text-[10px] mb-3 block">{t.lab.sectionLabel}</span>
          <h2 className="font-display text-2xl md:text-3xl tracking-[-0.02em] font-semibold">
            {lab.title_kz}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground font-light max-w-xl">
            {t.lab.description}
          </p>
        </div>
        {renderStatus()}
      </div>

      {/* Theory body — rendered as a styled, sectioned layout (hero +
          goal/equipment/theory/procedure/questions/conclusion cards). The
          `procedure_kz` field is reserved for the rare case where a teacher
          fills it separately via the CRUD form; in that case we render it
          as a plain Markdown block under the styled lab. */}
      {lab.theory_kz && (
        <TopicPhetContext.Provider value={{ defaultSimId: defaultPhetSimId }}>
          <LabFormDataContext.Provider value={formApi}>
            <div className="border-b border-border p-6 md:p-8">
              <LabContent markdown={lab.theory_kz} />
            </div>
          </LabFormDataContext.Provider>
        </TopicPhetContext.Provider>
      )}
      {lab.procedure_kz && (
        <div className="border-b border-border p-6 md:p-8">
          <span className="label-mono text-[10px] mb-3 block">{t.lab.procedureLabel}</span>
          <Markdown className="text-sm text-foreground/85 leading-relaxed font-light">
            {lab.procedure_kz}
          </Markdown>
        </div>
      )}

      {/* Existing submission view */}
      {existing && !editing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-6 md:p-8 space-y-6"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="label-mono text-[10px] text-muted-foreground">
                {t.lab.yourReport} · {t.lab.submittedAt} {formatDate(existing.submitted_at)}
              </span>
            </div>
            <pre className="text-sm font-light whitespace-pre-wrap text-foreground/90 font-body leading-relaxed border border-border bg-card/30 p-4">
              {existing.report_text}
            </pre>
          </div>

          {existing.report_file_url && (
            <div>
              <span className="label-mono text-[10px] text-muted-foreground mb-2 block">
                {t.lab.fileSubmitted}
              </span>
              {signedUrl ? (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 label-mono text-[10px] text-foreground border border-border hover:border-primary hover:text-primary px-3 py-2 transition-colors"
                >
                  <FileDown size={12} strokeWidth={1.4} />
                  {existing.report_file_url.split("/").pop()}
                </a>
              ) : (
                <span className="label-mono text-[10px] text-muted-foreground">
                  <Loader2 size={12} className="inline animate-spin mr-2" />
                  …
                </span>
              )}
            </div>
          )}

          {existing.teacher_comment && (
            <div className="border-l-2 border-primary pl-4">
              <span className="label-mono text-[10px] text-primary mb-2 block">
                {t.lab.teacherComment}
              </span>
              <p className="text-sm text-foreground/85 leading-relaxed font-light whitespace-pre-wrap">
                {existing.teacher_comment}
              </p>
            </div>
          )}

          <div>
            <button
              onClick={startEdit}
              className="label-mono text-[10px] text-foreground border border-border hover:border-primary hover:text-primary px-4 py-2 transition-colors"
            >
              {t.lab.resubmit} →
            </button>
          </div>
        </motion.div>
      )}

      {/* Edit/new submission form */}
      {(!existing || editing) && !isLoading && (
        <div className="p-6 md:p-8 space-y-6">
          <div className="space-y-2">
            <label className="label-mono text-[10px] text-muted-foreground block">
              {t.lab.reportLabel}
            </label>
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder={t.lab.reportPlaceholder}
              rows={10}
              className="w-full bg-background border border-border focus:border-primary outline-none p-3 text-sm font-light placeholder:text-muted-foreground/40 transition-colors resize-y font-body leading-relaxed"
            />
          </div>

          <div className="space-y-2">
            <label className="label-mono text-[10px] text-muted-foreground block">{t.lab.fileLabel}</label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
                id="lab-file-input"
              />
              <label
                htmlFor="lab-file-input"
                className="cursor-pointer inline-flex items-center gap-2 label-mono text-[10px] text-foreground border border-border hover:border-primary hover:text-primary px-3 py-2 transition-colors"
              >
                <Paperclip size={12} strokeWidth={1.4} />
                {file ? file.name : "Файл таңдау"}
              </label>
              {file && (
                <button
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="remove file"
                >
                  <X size={14} strokeWidth={1.4} />
                </button>
              )}
              <span className="label-mono text-[9px] text-muted-foreground/70">{t.lab.fileHint}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            {editing && (
              <button
                onClick={() => {
                  setEditing(false);
                  setReportText("");
                  setFile(null);
                }}
                className="label-mono text-[10px] text-muted-foreground hover:text-foreground px-3 py-2 transition-colors"
              >
                {t.problems.cancel}
              </button>
            )}
            <button
              onClick={submit}
              disabled={submitMutation.isPending || !reportText.trim()}
              className="group inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 size={12} strokeWidth={1.6} className="animate-spin" />
                  <span className="label-mono text-[10px]">{t.lab.submitting}</span>
                </>
              ) : (
                <span className="label-mono text-[10px]">{t.lab.submit}</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabSubmissionForm;
