import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Check, AlertCircle, Clock, FlaskConical, FileText } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import type { ActivityEvent } from "@/hooks/useStudentProgress";

interface Props {
  events: ActivityEvent[];
}

const StatusBadge = ({ status }: { status: ActivityEvent["status"] }) => {
  const { t } = useLang();
  switch (status) {
    case "correct":
      return (
        <span className="label-mono text-[9px] inline-flex items-center gap-1 text-primary">
          <Check size={9} strokeWidth={1.8} /> {t.profile.activityCorrect}
        </span>
      );
    case "incorrect":
      return (
        <span className="label-mono text-[9px] inline-flex items-center gap-1 text-destructive">
          <AlertCircle size={9} strokeWidth={1.8} /> {t.profile.activityIncorrect}
        </span>
      );
    case "graded":
      return (
        <span className="label-mono text-[9px] inline-flex items-center gap-1 text-primary">
          <Check size={9} strokeWidth={1.8} /> {t.profile.activityGraded}
        </span>
      );
    case "pending":
    default:
      return (
        <span className="label-mono text-[9px] inline-flex items-center gap-1 text-muted-foreground">
          <Clock size={9} strokeWidth={1.8} /> {t.profile.activityPending}
        </span>
      );
  }
};

const ActivityFeed = ({ events }: Props) => {
  const { t } = useLang();

  if (events.length === 0) {
    return (
      <section>
        <div className="flex items-baseline gap-3 mb-3">
          <span className="label-mono">{t.profile.activityLabel}</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="border border-border p-8 text-center">
          <p className="label-mono text-[11px] text-muted-foreground">{t.profile.activityEmpty}</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="label-mono">{t.profile.activityLabel}</span>
        <div className="flex-1 h-px bg-border" />
        <span className="label-mono text-[10px] text-muted-foreground tabular">{events.length}</span>
      </div>

      <ul className="border-t border-border">
        {events.map((e, i) => (
          <motion.li
            key={`${e.kind}-${e.id}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.025 }}
            className="border-b border-border"
          >
            <Link
              to={`/topics/${e.topic_week}`}
              className="grid grid-cols-12 gap-3 py-3 px-2 hover:bg-card/30 transition-colors group items-baseline"
            >
              {/* Icon column */}
              <span className="col-span-1 text-muted-foreground/70 group-hover:text-primary transition-colors flex items-center pt-1">
                {e.kind === "lab" ? (
                  <FlaskConical size={11} strokeWidth={1.4} />
                ) : (
                  <FileText size={11} strokeWidth={1.4} />
                )}
              </span>
              <span className="col-span-1 label-mono text-[10px] text-muted-foreground tabular">
                {String(e.topic_week).padStart(2, "0")}
              </span>
              <div className="col-span-7 min-w-0">
                <div className="text-sm text-foreground/90 font-light truncate">{e.topic_title}</div>
                {e.detail && (
                  <div className="label-mono text-[10px] text-muted-foreground/70 truncate mt-0.5">
                    {e.detail}
                  </div>
                )}
              </div>
              <span className="col-span-2 flex justify-end">
                <StatusBadge status={e.status} />
              </span>
              <span className="col-span-1 label-mono text-[9px] text-muted-foreground/70 tabular text-right">
                {new Date(e.created_at).toLocaleDateString("kk-KZ", { day: "2-digit", month: "2-digit" })}
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  );
};

export default ActivityFeed;
