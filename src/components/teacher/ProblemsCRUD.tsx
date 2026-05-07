import { useState } from "react";
import { Pencil, Trash2, Loader2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLang } from "@/i18n/LanguageContext";
import MathText from "@/components/MathText";
import {
  useTeacherProblems,
  useDeleteProblem,
  type ProblemRow,
} from "@/hooks/useTeacherContent";
import ProblemFormDialog from "./ProblemFormDialog";

const ROMAN = ["", "I", "II", "III"];

/**
 * Pull the solution body (which may have been stored either as a JSON array
 * of step strings or a single string) into a flat list of lines safe for
 * MathText rendering.
 */
function solutionLines(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x) => typeof x === "string" && x.trim().length > 0) as string[];
  }
  if (typeof raw === "string" && raw.trim()) return [raw];
  return [];
}

interface Props {
  topicId: string;
  weekNumber: number;
}

const ProblemsCRUD = ({ topicId, weekNumber }: Props) => {
  const { t } = useLang();
  const { data: problems, isLoading } = useTeacherProblems(topicId);
  const deleteMut = useDeleteProblem(topicId, weekNumber);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProblemRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (p: ProblemRow) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMut.mutateAsync(deleteId);
      toast.success(t.dashboard.contentDeleted);
    } catch {
      toast.error(t.dashboard.contentError);
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="label-mono text-[10px] text-muted-foreground tabular">
          N={problems?.length ?? 0}
        </span>
        <button
          onClick={openCreate}
          className="border border-foreground hover:bg-foreground hover:text-background label-mono text-[10px] px-3 py-2 transition-colors"
        >
          {t.dashboard.contentNewProblem}
        </button>
      </div>

      {isLoading && (
        <div className="label-mono text-[11px] text-muted-foreground text-center py-12">
          {t.topics.loading}
        </div>
      )}

      {!isLoading && (problems?.length ?? 0) === 0 && (
        <div className="border border-border p-12 text-center">
          <p className="label-mono text-[11px] text-muted-foreground">
            {t.dashboard.contentEmptyProblems}
          </p>
        </div>
      )}

      {!isLoading && problems && problems.length > 0 && (
        <div className="border border-border divide-y divide-border">
          {problems.map((p) => {
            const isOpen = expandedId === p.id;
            const steps = solutionLines(p.solution_steps);
            const hasSolution = steps.length > 0;
            const hasAnswer = !!p.expected_answer?.trim();

            return (
              <div key={p.id} className="hover:bg-card/30 transition-colors">
                {/* Top row — clickable to expand */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : p.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left"
                >
                  <span className="label-mono text-[10px] tabular text-muted-foreground w-8 shrink-0 mt-0.5">
                    #{p.sort_order}
                  </span>
                  <span className="label-mono text-[10px] text-primary w-8 shrink-0 mt-0.5">
                    {ROMAN[p.difficulty]}
                  </span>
                  <div
                    className={`text-sm font-light text-foreground/90 leading-snug flex-1 ${
                      isOpen ? "" : "line-clamp-2"
                    }`}
                  >
                    <MathText block={false}>{p.problem_text_kz}</MathText>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Compact indicators of presence */}
                    <span
                      className={`label-mono text-[10px] tabular ${
                        hasSolution ? "text-foreground" : "text-muted-foreground/40"
                      }`}
                      title={hasSolution ? t.dashboard.contentLabelSolution : t.dashboard.contentNoSolution}
                    >
                      Ш
                    </span>
                    <span
                      className={`label-mono text-[10px] tabular ${
                        hasAnswer ? "text-primary" : "text-muted-foreground/40"
                      }`}
                      title={hasAnswer ? t.dashboard.contentLabelExpectedAnswer : t.dashboard.contentNoAnswer}
                    >
                      Ж
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(p);
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      aria-label="edit"
                    >
                      <Pencil size={13} strokeWidth={1.4} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(p.id);
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      aria-label="delete"
                    >
                      <Trash2 size={13} strokeWidth={1.4} />
                    </button>
                    <ChevronDown
                      size={14}
                      strokeWidth={1.4}
                      className={`text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {/* Expanded panel — solution + expected answer */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border bg-card/20 px-4 py-3 grid gap-4 md:grid-cols-2">
                        {/* Solution */}
                        <div>
                          <span className="label-mono text-[10px] text-muted-foreground block mb-2">
                            {t.dashboard.contentLabelSolution}
                          </span>
                          {hasSolution ? (
                            <div className="text-sm font-light text-foreground/90 leading-relaxed space-y-1.5">
                              {steps.map((line, i) => (
                                <div key={i}>
                                  <MathText>{line}</MathText>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="label-mono text-[10px] text-muted-foreground/60">
                              — {t.dashboard.contentNoSolution}
                            </span>
                          )}
                        </div>

                        {/* Expected answer */}
                        <div>
                          <span className="label-mono text-[10px] text-muted-foreground block mb-2">
                            {t.dashboard.contentLabelExpectedAnswer}
                          </span>
                          {hasAnswer ? (
                            <div className="text-sm font-display tabular text-primary inline-flex items-baseline gap-1.5">
                              <MathText block={false}>{p.expected_answer}</MathText>
                              {p.unit && <span className="text-muted-foreground">{p.unit}</span>}
                            </div>
                          ) : (
                            <span className="label-mono text-[10px] text-muted-foreground/60">
                              — {t.dashboard.contentNoAnswer}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      <ProblemFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        topicId={topicId}
        weekNumber={weekNumber}
        initial={editing}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent className="bg-background border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display tracking-tight">
              {t.dashboard.contentDeleteConfirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-light">
              {t.dashboard.contentDeleteConfirmDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border border-border hover:border-foreground label-mono text-[10px]">
              {t.dashboard.contentCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 label-mono text-[10px]"
            >
              {deleteMut.isPending && <Loader2 size={11} className="mr-2 animate-spin" />}
              {t.dashboard.contentDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProblemsCRUD;
