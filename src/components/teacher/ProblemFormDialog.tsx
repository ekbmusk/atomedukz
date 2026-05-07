import { useEffect, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLang } from "@/i18n/LanguageContext";
import MathText from "@/components/MathText";
import {
  useCreateProblem,
  useUpdateProblem,
  type ProblemRow,
} from "@/hooks/useTeacherContent";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topicId: string;
  weekNumber: number;
  initial?: ProblemRow | null; // edit mode if present
}

const DIFFICULTIES: Array<{ value: 1 | 2 | 3; label: string }> = [
  { value: 1, label: "I" },
  { value: 2, label: "II" },
  { value: 3, label: "III" },
];

const ProblemFormDialog = ({ open, onOpenChange, topicId, weekNumber, initial }: Props) => {
  const { t } = useLang();
  const createMut = useCreateProblem(weekNumber);
  const updateMut = useUpdateProblem(weekNumber);

  const isEdit = !!initial;

  const [textKz, setTextKz] = useState("");
  const [textRu, setTextRu] = useState("");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(1);
  const [answer, setAnswer] = useState("");
  const [unit, setUnit] = useState("");
  const [tolerance, setTolerance] = useState("");
  const [weight, setWeight] = useState("1");
  const [solutionStepsRaw, setSolutionStepsRaw] = useState("[]");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Reset on open or initial change
  useEffect(() => {
    if (!open) return;
    setTextKz(initial?.problem_text_kz ?? "");
    setTextRu(initial?.problem_text_ru ?? "");
    setDifficulty(initial?.difficulty ?? 1);
    setAnswer(initial?.expected_answer ?? "");
    setUnit(initial?.unit ?? "");
    setTolerance(initial?.tolerance != null ? String(initial.tolerance) : "");
    setWeight(initial?.weight != null ? String(initial.weight) : "1");
    setSolutionStepsRaw(
      initial?.solution_steps ? JSON.stringify(initial.solution_steps, null, 2) : "[]",
    );
    setJsonError(null);
  }, [open, initial]);

  const submitting = createMut.isPending || updateMut.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textKz.trim()) return;

    let parsedSteps: unknown = [];
    if (solutionStepsRaw.trim()) {
      try {
        parsedSteps = JSON.parse(solutionStepsRaw);
      } catch {
        setJsonError(t.dashboard.contentJsonInvalid);
        return;
      }
    }

    const payload = {
      topic_id: topicId,
      problem_text_kz: textKz.trim(),
      problem_text_ru: textRu.trim() || null,
      difficulty,
      expected_answer: answer.trim() || null,
      unit: unit.trim() || null,
      tolerance: tolerance.trim() ? Number(tolerance) : null,
      weight: weight.trim() ? Number(weight) : 1,
      solution_steps: parsedSteps,
    };

    try {
      if (isEdit && initial) {
        await updateMut.mutateAsync({ id: initial.id, ...payload });
      } else {
        await createMut.mutateAsync(payload);
      }
      toast.success(t.dashboard.contentSaved);
      onOpenChange(false);
    } catch {
      toast.error(t.dashboard.contentError);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            {isEdit ? t.dashboard.contentEditProblem : t.dashboard.contentNewProblem.replace(/^\+\s*/, "")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <Field label={t.dashboard.contentFieldText} required>
            <textarea
              value={textKz}
              onChange={(e) => setTextKz(e.target.value)}
              rows={4}
              required
              className={`${textareaCls} font-mono`}
            />
            {textKz.trim() && (
              <div className="mt-2 border border-border bg-card/30 px-3 py-2">
                <span className="label-mono text-[10px] text-muted-foreground inline-flex items-center gap-1.5 mb-1.5">
                  <Eye size={10} strokeWidth={1.6} />
                  {t.dashboard.editorPreview}
                </span>
                <div className="text-sm text-foreground/90 leading-relaxed">
                  <MathText>{textKz}</MathText>
                </div>
              </div>
            )}
          </Field>

          <Field label={t.dashboard.contentFieldTextRu}>
            <textarea
              value={textRu}
              onChange={(e) => setTextRu(e.target.value)}
              rows={2}
              className={`${textareaCls} font-mono`}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label={t.dashboard.contentFieldDifficulty}>
              <div className="flex gap-px bg-border">
                {DIFFICULTIES.map((d) => (
                  <button
                    type="button"
                    key={d.value}
                    onClick={() => setDifficulty(d.value)}
                    className={`flex-1 py-2 label-mono text-[11px] transition-colors ${
                      difficulty === d.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t.dashboard.contentFieldWeight}>
              <input
                type="number"
                step="0.5"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="">
              <span className="label-mono text-[10px] text-muted-foreground inline-flex items-center h-9">
                {!isEdit && t.dashboard.contentSortAuto}
              </span>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label={t.dashboard.contentFieldAnswer}>
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t.dashboard.contentFieldUnit}>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={inputCls}
                placeholder="эВ, нм, м/с"
              />
            </Field>
            <Field label={t.dashboard.contentFieldTolerance}>
              <input
                type="number"
                step="0.001"
                min="0"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
                className={inputCls}
                placeholder="0.05"
              />
            </Field>
          </div>

          <Field label={t.dashboard.contentFieldSolutionSteps} hint={jsonError ?? undefined}>
            <textarea
              value={solutionStepsRaw}
              onChange={(e) => {
                setSolutionStepsRaw(e.target.value);
                setJsonError(null);
              }}
              rows={4}
              className={`${textareaCls} font-mono`}
              spellCheck={false}
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="border border-border hover:border-foreground label-mono text-[10px] px-3 py-2 transition-colors"
            >
              {t.dashboard.contentCancel}
            </button>
            <button
              type="submit"
              disabled={submitting || !textKz.trim()}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 label-mono text-[10px] px-4 py-2 transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 size={11} strokeWidth={1.6} className="animate-spin" />}
              {isEdit ? t.dashboard.contentSave : t.dashboard.contentCreate}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const inputCls =
  "w-full h-9 bg-background border border-border focus:border-primary outline-none px-2 text-sm font-light placeholder:text-muted-foreground/40 transition-colors font-body";
const textareaCls =
  "w-full bg-background border border-border focus:border-primary outline-none p-2 text-sm font-light placeholder:text-muted-foreground/40 transition-colors resize-y font-body";

const Field = ({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <label className="block">
    {label && (
      <span className="label-mono text-[10px] text-muted-foreground mb-1 block">
        {label}
        {required && <span className="text-primary"> *</span>}
      </span>
    )}
    {children}
    {hint && <span className="label-mono text-[10px] text-destructive mt-1 block">{hint}</span>}
  </label>
);

export default ProblemFormDialog;
