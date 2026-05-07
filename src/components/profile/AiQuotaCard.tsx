import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageContext";

interface Props {
  userId: string;
}

const DAILY_QUOTA = 10;

/**
 * Today's AI-tutor quota for the student. Shows used/total + a progress
 * bar, a stand-alone block aligned next to the streak hero on the
 * profile page.
 *
 * Counts rows from `ai_hints` with `created_at > now() - 24h` for the
 * current user. RLS already restricts SELECT to own hints, so the
 * direct table query is safe — no need for an extra RPC.
 */
const AiQuotaCard = ({ userId }: Props) => {
  const { t } = useLang();

  const { data: usedToday = 0 } = useQuery({
    queryKey: ["ai-quota-today", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("ai_hints" as never)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since);
      if (error) return 0;
      return count ?? 0;
    },
    // Refresh on focus and after mutations elsewhere; otherwise the
    // counter would only update on hard reload.
    staleTime: 60 * 1000,
  });

  const remaining = Math.max(0, DAILY_QUOTA - usedToday);
  const pct = Math.min(100, (usedToday / DAILY_QUOTA) * 100);
  const exhausted = remaining === 0;

  return (
    <div className="bg-background p-5 flex items-center gap-4">
      <Sparkles
        size={24}
        strokeWidth={1.6}
        className={exhausted ? "text-muted-foreground/50" : "text-primary"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="label-mono text-[10px] text-muted-foreground">
            {t.profile.aiQuotaLabel}
          </span>
          <span
            className={`font-display tabular text-base leading-none ${
              exhausted ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {exhausted
              ? t.profile.aiQuotaExhausted
              : t.profile.aiQuotaUsage.replace("{used}", String(usedToday))}
          </span>
        </div>
        <div className="h-1 bg-border relative overflow-hidden">
          <div
            className={`absolute left-0 top-0 bottom-0 transition-all duration-500 ${
              exhausted ? "bg-muted-foreground/40" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 label-mono text-[9px] text-muted-foreground/70">
          {t.profile.aiQuotaHint}
        </p>
      </div>
    </div>
  );
};

export default AiQuotaCard;
