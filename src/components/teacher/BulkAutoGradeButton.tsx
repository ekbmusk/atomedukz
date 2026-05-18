import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { useBulkAutoGradeLabs } from "@/hooks/useBulkAutoGradeLabs";
import type { PendingLabSubmission } from "@/hooks/useTeacherDashboard";

interface Props {
  submissions: PendingLabSubmission[];
}

const BulkAutoGradeButton = ({ submissions }: Props) => {
  const { t } = useLang();
  const { user } = useAuth();
  const mutation = useBulkAutoGradeLabs();
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(
    null,
  );

  const n = submissions.length;
  const busy = mutation.isPending;

  const run = async () => {
    if (!user || n === 0) return;
    const confirmMsg = t.dashboard.bulkAutoGradeConfirm.replace("{n}", String(n));
    if (!window.confirm(confirmMsg)) return;

    try {
      const result = await mutation.mutateAsync({
        submissions,
        reviewerId: user.id,
        onProgress: (done, total, label) => setProgress({ done, total, label }),
      });
      const msg = t.dashboard.bulkAutoGradeDone
        .replace("{applied}", String(result.applied))
        .replace("{failed}", String(result.failed));
      if (result.failed > 0) toast.warning(msg);
      else toast.success(msg);
    } catch (e) {
      console.error(e);
      toast.error(t.dashboard.aiGradeError);
    } finally {
      setProgress(null);
    }
  };

  if (n === 0) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="group inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 hover:bg-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? (
          <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
        ) : (
          <Sparkles size={14} strokeWidth={1.8} />
        )}
        <span className="label-mono text-[10px]">{t.dashboard.bulkAutoGradeButton}</span>
      </button>
      {busy && progress && (
        <span className="label-mono text-[10px] text-muted-foreground tabular">
          {t.dashboard.bulkAutoGradeProgress
            .replace("{done}", String(progress.done))
            .replace("{total}", String(progress.total))}
          {progress.label ? ` · ${progress.label}` : ""}
        </span>
      )}
    </div>
  );
};

export default BulkAutoGradeButton;
