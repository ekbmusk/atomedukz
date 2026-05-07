import { AlertTriangle } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { useStuckStudents } from "@/hooks/useTeacherAnalytics";

const StuckStudentsList = ({ onPickStudent }: { onPickStudent?: (userId: string) => void }) => {
  const { t } = useLang();
  const { data, isLoading } = useStuckStudents();

  return (
    <div className="border border-border bg-background">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <AlertTriangle size={12} strokeWidth={1.4} className="text-muted-foreground" />
        <span className="label-mono text-[10px] text-muted-foreground">
          {t.dashboard.analyticsTitleStuck}
        </span>
        {data && data.length > 0 && (
          <span className="label-mono text-[10px] text-primary tabular ml-auto">
            N={data.length}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="px-4 py-8 text-center label-mono text-[11px] text-muted-foreground">
          {t.topics.loading}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <div className="px-4 py-8 text-center label-mono text-[11px] text-muted-foreground">
          {t.dashboard.analyticsEmpty}
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="divide-y divide-border">
          {data.map((s) => (
            <button
              key={`${s.user_id}-${s.topic_id}`}
              onClick={() => onPickStudent?.(s.user_id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-card/30 transition-colors text-left"
            >
              <span className="label-mono text-[10px] tabular text-muted-foreground w-10 shrink-0">
                {t.dashboard.weekShort}
                {String(s.week_number).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-light text-foreground truncate">{s.full_name}</div>
                <div className="label-mono text-[10px] text-muted-foreground truncate">
                  {s.title_kz}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 label-mono text-[10px] tabular">
                {s.pending_count > 0 && (
                  <span className="text-muted-foreground">
                    {s.pending_count} {t.dashboard.analyticsStuckPending}
                  </span>
                )}
                {s.incorrect_streak > 0 && (
                  <span className="text-destructive">
                    {s.incorrect_streak} {t.dashboard.analyticsStuckIncorrectStreak}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StuckStudentsList;
