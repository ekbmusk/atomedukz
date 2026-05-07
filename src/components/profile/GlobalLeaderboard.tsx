import { motion } from "framer-motion";
import { useLang } from "@/i18n/LanguageContext";
import Avatar from "@/components/Avatar";
import type { LeaderboardRow } from "@/hooks/useGlobalLeaderboard";

interface Props {
  rows: LeaderboardRow[];
}

/**
 * Global student ranking sourced from `get_global_leaderboard` RPC.
 * Replaces the old GroupLeaderboard — there are no groups anymore, so
 * we simply rank everyone (top 50). The student's own row is highlighted
 * with `is_self`.
 */
const GlobalLeaderboard = ({ rows }: Props) => {
  const { t } = useLang();

  if (rows.length === 0) {
    return (
      <section>
        <div className="flex items-baseline gap-3 mb-3">
          <span className="label-mono">{t.profile.leaderboardLabel}</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="border border-border p-8 text-center">
          <p className="label-mono text-[11px] text-muted-foreground">
            {t.profile.leaderboardEmpty}
          </p>
        </div>
      </section>
    );
  }

  const maxScore = Math.max(...rows.map((r) => r.score), 1);

  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="label-mono">{t.profile.leaderboardLabel}</span>
        <div className="flex-1 h-px bg-border" />
        <span className="label-mono text-[10px] text-muted-foreground tabular">
          N={rows.length}
        </span>
      </div>

      <ul className="border-t border-border">
        {rows.map((r, i) => {
          const fillPct = Math.round((r.score / maxScore) * 100);
          return (
            <motion.li
              key={r.user_id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.4) }}
              className={`relative border-b border-border ${
                r.is_self ? "bg-primary/5" : ""
              }`}
            >
              <div
                className="absolute left-0 top-0 bottom-0 bg-primary/8 pointer-events-none"
                style={{ width: `${fillPct}%` }}
              />

              <div className="relative grid grid-cols-12 gap-3 py-3 px-3 items-center">
                <span
                  className={`col-span-1 font-display tabular text-base ${
                    r.rank === 1
                      ? "text-primary font-semibold"
                      : r.rank <= 3
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {r.rank}
                </span>
                <div className="col-span-7 min-w-0 flex items-center gap-2.5">
                  <Avatar url={r.avatar_url} name={r.full_name} size={28} />
                  <span
                    className={`text-sm truncate ${
                      r.is_self
                        ? "text-foreground font-medium"
                        : "text-foreground/85 font-light"
                    }`}
                  >
                    {r.full_name}
                  </span>
                  {r.is_self && (
                    <span className="label-mono text-[9px] text-primary shrink-0">
                      ← {t.profile.leaderboardYou}
                    </span>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <div className="font-display tabular text-sm text-foreground">
                    {r.problems_correct}
                  </div>
                  <div className="label-mono text-[9px] text-muted-foreground">есеп</div>
                </div>
                <div className="col-span-2 text-right">
                  <div
                    className={`font-display tabular text-sm ${
                      r.labs_avg_score == null
                        ? "text-muted-foreground/50"
                        : "text-foreground"
                    }`}
                  >
                    {r.labs_avg_score ?? "—"}
                  </div>
                  <div className="label-mono text-[9px] text-muted-foreground">лаб</div>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
};

export default GlobalLeaderboard;
