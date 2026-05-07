import { useEffect, useState } from "react";
import { Bell, Check, MessageSquare, AlertCircle, FlaskConical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import {
  useStudentPendingCount,
  useStudentRecentEvents,
  getLastSeenAt,
  markAllSeen,
  type StudentRecentEvent,
} from "@/hooks/useStudentNotifications";

const formatRelative = (iso: string) => {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "сейчас";
  if (m < 60) return `${m}м`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}с`;
  const days = Math.floor(h / 24);
  return `${days}к`;
};

const KindIcon = ({ event }: { event: StudentRecentEvent }) => {
  if (event.kind === "lab") return <FlaskConical size={11} strokeWidth={1.6} className="text-primary" />;
  if (event.kind_label === "dispute_resolved")
    return <AlertCircle size={11} strokeWidth={1.6} className="text-primary" />;
  if (event.kind_label === "comment")
    return <MessageSquare size={11} strokeWidth={1.6} className="text-muted-foreground" />;
  return <Check size={11} strokeWidth={1.8} className="text-primary" />;
};

const StudentNotificationsBell = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  // We snapshot last_seen on mount + on dropdown open so the new/old
  // visual distinction is stable while the dropdown is showing. Without
  // it, opening the bell would mark all-seen *and* immediately re-render
  // them as "old".
  const [lastSeenSnapshot, setLastSeenSnapshot] = useState(() => getLastSeenAt());

  const { data: count = 0 } = useStudentPendingCount(user?.id);
  const { data: events } = useStudentRecentEvents(user?.id, open);

  useEffect(() => {
    if (open) setLastSeenSnapshot(getLastSeenAt());
  }, [open]);

  const onOpenChange = (next: boolean) => {
    if (!next && count > 0) {
      // User just closed the dropdown — mark everything seen so the
      // badge clears next refetch.
      markAllSeen();
      qc.invalidateQueries({ queryKey: ["student", "notifications", "pending_count"] });
    }
    setOpen(next);
  };

  const tNotif = t.profile.notifications;

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative text-muted-foreground hover:text-foreground transition-colors"
          aria-label={tNotif.title}
        >
          <Bell size={15} strokeWidth={1.4} />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 bg-primary text-primary-foreground label-mono text-[9px] tabular flex items-center justify-center rounded-full">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="w-80 bg-background border border-border p-0"
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="label-mono text-[10px] text-muted-foreground">{tNotif.title}</span>
          {count > 0 && (
            <span className="label-mono text-[10px] text-primary tabular">
              {count} {tNotif.newLabel}
            </span>
          )}
        </div>

        {(!events || events.length === 0) && (
          <div className="px-4 py-8 text-center label-mono text-[11px] text-muted-foreground">
            {tNotif.empty}
          </div>
        )}

        {events && events.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {events.map((e) => {
              const isNew = e.reviewed_at > lastSeenSnapshot;
              return (
                <button
                  key={`${e.kind}-${e.id}`}
                  onClick={() => {
                    setOpen(false);
                    navigate(`/topics/${e.week_number}`);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-card/40 transition-colors flex items-start gap-3 ${
                    isNew ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="w-4 mt-0.5 shrink-0 flex justify-center">
                    <KindIcon event={e} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-light text-foreground/95 truncate">
                      <span className="label-mono text-[10px] tabular text-muted-foreground mr-2">
                        А{String(e.week_number).padStart(2, "0")}
                      </span>
                      {tNotif[
                        e.kind === "lab"
                          ? "labGraded"
                          : e.kind_label === "dispute_resolved"
                            ? "disputeResolved"
                            : e.kind_label === "comment"
                              ? "problemComment"
                              : "problemGraded"
                      ]}
                    </div>
                    <div className="label-mono text-[10px] text-muted-foreground truncate">
                      {e.topic_title}
                    </div>
                  </div>
                  <span className="label-mono text-[10px] text-muted-foreground tabular shrink-0">
                    {formatRelative(e.reviewed_at)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default StudentNotificationsBell;
