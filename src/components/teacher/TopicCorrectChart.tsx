import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useLang } from "@/i18n/LanguageContext";
import { useTopicStats } from "@/hooks/useTeacherAnalytics";

const TopicCorrectChart = () => {
  const { t } = useLang();
  const { data, isLoading } = useTopicStats();

  if (isLoading) return <Loading />;
  if (!data || data.length === 0) return <Empty />;

  const chartData = data.map((d) => ({
    week: `А${String(d.week_number).padStart(2, "0")}`,
    title: d.title_kz,
    correctPct: d.correct_pct ?? 0,
    attempts: d.attempts_total,
  }));

  return (
    <ChartShell title={t.dashboard.analyticsTitleCorrectPct}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={13} />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={13}
            domain={[0, 100]}
            unit="%"
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              fontSize: 14,
            }}
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(v: number) => [`${v}%`, t.dashboard.analyticsAxisPercent]}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload as { title: string } | undefined;
              return row ? `${label} · ${row.title}` : label;
            }}
          />
          <Bar dataKey="correctPct" fill="hsl(var(--primary))" radius={0} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
};

export const ChartShell = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border border-border bg-background">
    <div className="px-4 py-3 border-b border-border">
      <span className="label-mono text-[10px] text-muted-foreground">{title}</span>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Loading = () => {
  const { t } = useLang();
  return (
    <div className="border border-border p-12 text-center">
      <span className="label-mono text-[11px] text-muted-foreground">{t.topics.loading}</span>
    </div>
  );
};
const Empty = () => {
  const { t } = useLang();
  return (
    <div className="border border-border p-12 text-center">
      <span className="label-mono text-[11px] text-muted-foreground">{t.dashboard.analyticsEmpty}</span>
    </div>
  );
};

export default TopicCorrectChart;
