import { useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLang } from "@/i18n/LanguageContext";
import { usePendingCount, useRecentEvents } from "@/hooks/useTeacherNotifications";

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

const NotificationsBell = () => {
  const { t } = useLang();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: counts } = usePendingCount();
  const { data: events } = useRecentEvents(open); // only fetch when open

  const total = counts?.total ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t.dashboard.notificationsTitle}
        >
          <Bell size={15} strokeWidth={1.4} />
          {total > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 bg-primary text-primary-foreground label-mono text-[9px] tabular flex items-center justify-center rounded-full">
              {total > 99 ? "99+" : total}
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
          <span className="label-mono text-[10px] text-muted-foreground">
            {t.dashboard.notificationsTitle}
          </span>
          {total > 0 && (
            <span className="label-mono text-[10px] text-primary tabular">
              {total} {t.dashboard.notificationsPendingLabel}
            </span>
          )}
        </div>

        {(!events || events.length === 0) && (
          <div className="px-4 py-8 text-center label-mono text-[11px] text-muted-foreground">
            {t.dashboard.notificationsEmpty}
          </div>
        )}

        {events && events.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {events.map((e) => (
              <button
                key={`${e.kind}-${e.id}`}
                onClick={() => {
                  setOpen(false);
                  navigate(`/dashboard?tab=queue&focus=${e.id}`);
                }}
                className="w-full px-4 py-3 text-left hover:bg-card/40 transition-colors flex items-start gap-3"
              >
                <span className="label-mono text-[10px] tabular text-muted-foreground w-10 shrink-0 mt-0.5">
                  {t.dashboard.weekShort}
                  {String(e.week_number).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-light text-foreground/95 truncate">
                    {e.student_name}{" "}
                    <span className="text-muted-foreground">
                      —{" "}
                      {e.kind === "problem"
                        ? t.dashboard.notificationsEventProblem
                        : t.dashboard.notificationsEventLab}
                    </span>
                  </div>
                  <div className="label-mono text-[10px] text-muted-foreground truncate">
                    {e.topic_title}
                  </div>
                </div>
                <span className="label-mono text-[10px] text-muted-foreground tabular shrink-0">
                  {formatRelative(e.created_at)}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="px-4 py-2 border-t border-border">
          <button
            onClick={() => {
              setOpen(false);
              navigate("/dashboard?tab=queue");
            }}
            className="w-full label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            {t.dashboard.notificationsViewAll} →
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationsBell;
