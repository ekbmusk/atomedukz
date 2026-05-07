import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLang } from "@/i18n/LanguageContext";
import {
  useCreateVideo,
  useUpdateVideo,
  type VideoRow,
} from "@/hooks/useTeacherContent";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topicId: string;
  weekNumber: number;
  initial?: VideoRow | null;
}

const VideoFormDialog = ({ open, onOpenChange, topicId, weekNumber, initial }: Props) => {
  const { t } = useLang();
  const createMut = useCreateVideo(weekNumber);
  const updateMut = useUpdateVideo(weekNumber);

  const isEdit = !!initial;
  const [titleKz, setTitleKz] = useState("");
  const [titleRu, setTitleRu] = useState("");
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitleKz(initial?.title_kz ?? "");
    setTitleRu(initial?.title_ru ?? "");
    setUrl(initial?.url ?? "");
    setDuration(initial?.duration_seconds != null ? String(initial.duration_seconds) : "");
  }, [open, initial]);

  const submitting = createMut.isPending || updateMut.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleKz.trim() || !url.trim()) return;

    const payload = {
      topic_id: topicId,
      title_kz: titleKz.trim(),
      title_ru: titleRu.trim() || null,
      url: url.trim(),
      duration_seconds: duration.trim() ? Number(duration) : null,
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
      <DialogContent className="bg-background border border-border max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            {isEdit ? t.dashboard.contentEditVideo : t.dashboard.contentNewVideo.replace(/^\+\s*/, "")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <Field label={t.dashboard.contentFieldTitle} required>
            <input
              type="text"
              value={titleKz}
              onChange={(e) => setTitleKz(e.target.value)}
              required
              className={inputCls}
            />
          </Field>

          <Field label={t.dashboard.contentFieldTitleRu}>
            <input
              type="text"
              value={titleRu}
              onChange={(e) => setTitleRu(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label={t.dashboard.contentFieldUrl} required>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://youtu.be/..."
              className={inputCls}
            />
          </Field>

          <Field label={t.dashboard.contentFieldDuration}>
            <input
              type="number"
              min="0"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={inputCls}
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
              disabled={submitting || !titleKz.trim() || !url.trim()}
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

const Field = ({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className="label-mono text-[10px] text-muted-foreground mb-1 block">
      {label}
      {required && <span className="text-primary"> *</span>}
    </span>
    {children}
  </label>
);

export default VideoFormDialog;
