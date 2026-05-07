import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useLang } from "@/i18n/LanguageContext";
import type { TopicProgress } from "@/hooks/useStudentProgress";

interface Props {
  perTopic: TopicProgress[];
}

const TopicProgressStrip = ({ perTopic }: Props) => {
  const { t } = useLang();

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

      <p className="mt-3 label-mono text-[9px] text-muted-foreground/70">
        {t.profile.progressLegend}
      </p>
    </section>
  );
};

export default TopicProgressStrip;
