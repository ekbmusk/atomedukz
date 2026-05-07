import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import type { TopicProgress } from "@/hooks/useStudentProgress";

interface Props {
  perTopic: TopicProgress[];
}

/** "2 күн бұрын" / "бүгін" / "кеше" / "DD/MM" — short relative date in
 *  Kazakh. Falls back to numeric DD/MM for anything older than 7 days. */
function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - then.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "бүгін";
  if (days === 1) return "кеше";
  if (days < 7) return `${days} күн бұрын`;
  return `${String(then.getDate()).padStart(2, "0")}/${String(then.getMonth() + 1).padStart(2, "0")}`;
}

const TopicProgressStrip = ({ perTopic }: Props) => {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);

  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="label-mono">{t.profile.progressLabel}</span>
        <div className="flex-1 h-px bg-border" />
        <span className="label-mono text-[10px] text-muted-foreground tabular">
          {perTopic.filter((p) => p.attempts_total > 0).length}/{perTopic.length}
        </span>
      </div>

      <div
        className="grid grid-cols-5 sm:grid-cols-8 gap-px bg-border md:[grid-template-columns:repeat(15,minmax(0,1fr))]"
      >
        {perTopic.map((p, i) => {
          const fillPct =
            p.problems_total > 0
              ? Math.min(100, Math.round((p.attempts_correct / p.problems_total) * 100))
              : 0;
          const hasActivity = p.attempts_total > 0;

          return (
            <Link
              key={p.topic_id}
              to={`/topics/${p.week_number}`}
              className="group relative bg-background hover:bg-card/40 transition-colors"
              title={`${p.title_kz} · ${p.attempts_correct}/${p.problems_total}`}
            >
              <div className="aspect-square relative overflow-hidden">
                {/* Fill from bottom */}
                <motion.div
                  className="absolute left-0 right-0 bottom-0 bg-primary/25 group-hover:bg-primary/40 transition-colors"
                  initial={{ height: 0 }}
                  animate={{ height: `${fillPct}%` }}
                  transition={{ duration: 0.6, delay: 0.04 * i, ease: [0.25, 0.4, 0.25, 1] }}
                />

                {/* Lab indicator (top-right corner dot) */}
                {p.lab_submitted && (
                  <span
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent"
                    aria-hidden
                  />
                )}

                {/* Week number, centered */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className={`font-display tabular text-base md:text-lg leading-none transition-colors ${
                      hasActivity ? "text-foreground" : "text-muted-foreground/50"
                    }`}
                  >
                    {String(p.week_number).padStart(2, "0")}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="label-mono text-[9px] text-muted-foreground/70">
          {t.profile.progressLegend}
        </p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
        >
          {expanded ? t.profile.detailToggleHide : t.profile.detailToggleShow}
          <ChevronDown
            size={11}
            strokeWidth={1.6}
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail-table"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 border border-border">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 label-mono text-[9px] text-muted-foreground border-b border-border bg-card/30 px-3 py-2">
                <div className="col-span-1 tabular">№</div>
                <div className="col-span-5">{t.profile.detailColTopic}</div>
                <div className="col-span-3 tabular">{t.profile.detailColProblems}</div>
                <div className="col-span-1 tabular text-right">{t.profile.detailColLab}</div>
                <div className="col-span-2 text-right">{t.profile.detailColLastActivity}</div>
              </div>

              {/* Body rows */}
              {perTopic.map((p) => {
                const pct =
                  p.problems_total > 0
                    ? Math.round((p.attempts_correct / p.problems_total) * 100)
                    : 0;
                const hasActivity = p.attempts_total > 0;
                return (
                  <Link
                    key={p.topic_id}
                    to={`/topics/${p.week_number}`}
                    className={`grid grid-cols-12 gap-2 px-3 py-2 text-xs border-b border-border last:border-b-0 transition-colors ${
                      hasActivity
                        ? "text-foreground hover:bg-card/40"
                        : "text-muted-foreground/70 hover:bg-card/30"
                    }`}
                  >
                    <div className="col-span-1 label-mono text-[10px] tabular text-muted-foreground self-center">
                      {String(p.week_number).padStart(2, "0")}
                    </div>
                    <div className="col-span-5 truncate self-center" title={p.title_kz}>
                      {p.title_kz}
                    </div>
                    <div className="col-span-3 tabular self-center">
                      {hasActivity ? (
                        <span>
                          {p.attempts_correct}
                          <span className="text-muted-foreground/60">/{p.problems_total}</span>
                          <span className="ml-2 text-muted-foreground">{pct}%</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">{t.profile.detailNoActivity}</span>
                      )}
                    </div>
                    <div className="col-span-1 tabular text-right self-center">
                      {p.lab_score != null ? (
                        <span className={p.lab_score >= 70 ? "text-primary" : ""}>{p.lab_score}</span>
                      ) : p.lab_submitted ? (
                        <span className="text-muted-foreground/70">···</span>
                      ) : (
                        <span className="text-muted-foreground/40">{t.profile.detailNoActivity}</span>
                      )}
                    </div>
                    <div className="col-span-2 label-mono text-[10px] text-muted-foreground text-right self-center">
                      {formatRelative(p.last_activity_at)}
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default TopicProgressStrip;
