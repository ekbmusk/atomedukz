import { useState } from "react";
import { Pencil, Trash2, ExternalLink, Loader2 } from "lucide-react";
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
import {
  useTeacherVideos,
  useDeleteVideo,
  type VideoRow,
} from "@/hooks/useTeacherContent";
import VideoFormDialog from "./VideoFormDialog";

interface Props {
  topicId: string;
  weekNumber: number;
}

const VideosCRUD = ({ topicId, weekNumber }: Props) => {
  const { t } = useLang();
  const { data: videos, isLoading } = useTeacherVideos(topicId);
  const deleteMut = useDeleteVideo(topicId, weekNumber);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VideoRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
          N={videos?.length ?? 0}
        </span>
        <button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="border border-foreground hover:bg-foreground hover:text-background label-mono text-[10px] px-3 py-2 transition-colors"
        >
          {t.dashboard.contentNewVideo}
        </button>
      </div>

      {isLoading && (
        <div className="label-mono text-[11px] text-muted-foreground text-center py-12">
          {t.topics.loading}
        </div>
      )}

      {!isLoading && (videos?.length ?? 0) === 0 && (
        <div className="border border-border p-12 text-center">
          <p className="label-mono text-[11px] text-muted-foreground">
            {t.dashboard.contentEmptyVideos}
          </p>
        </div>
      )}

      {!isLoading && videos && videos.length > 0 && (
        <div className="border border-border divide-y divide-border">
          {videos.map((v) => (
            <div
              key={v.id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-card/30 transition-colors"
            >
              <span className="label-mono text-[10px] tabular text-muted-foreground w-8 shrink-0 mt-0.5">
                #{v.sort_order}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-light text-foreground/90 line-clamp-1">{v.title_kz}</div>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className="label-mono text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors truncate max-w-full"
                >
                  <ExternalLink size={10} strokeWidth={1.4} />
                  <span className="truncate">{v.url}</span>
                </a>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setEditing(v);
                    setDialogOpen(true);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="edit"
                >
                  <Pencil size={13} strokeWidth={1.4} />
                </button>
                <button
                  onClick={() => setDeleteId(v.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  aria-label="delete"
                >
                  <Trash2 size={13} strokeWidth={1.4} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <VideoFormDialog
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

export default VideosCRUD;
