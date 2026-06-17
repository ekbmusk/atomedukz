import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useLang } from "@/i18n/LanguageContext";
import { useTopicStats } from "@/hooks/useTeacherAnalytics";
import { ChartShell } from "./TopicCorrectChart";

const TopicLabAvgChart = () => {
  const { t } = useLang();
  const { data, isLoading } = useTopicStats();

  if (isLoading || !data || data.length === 0) {
    return (
      <ChartShell title={t.dashboard.analyticsTitleLabAvg}>
        <div className="py-8 text-center label-mono text-[11px] text-muted-foreground">
          {isLoading ? t.topics.loading : t.dashboard.analyticsEmpty}
        </div>
      </ChartShell>
    );
  }

  const chartData = data.map((d) => ({
    week: `А${String(d.week_number).padStart(2, "0")}`,
    title: d.title_kz,
    avg: d.labs_avg_score ?? 0,
    submitted: d.labs_submitted,
  }));

  return (
    <ChartShell title={t.dashboard.analyticsTitleLabAvg}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={13} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={13} domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              fontSize: 14,
            }}
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(v: number) => [v, t.dashboard.analyticsAxisScore]}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload as { title: string } | undefined;
              return row ? `${label} · ${row.title}` : label;
            }}
          />
          <Bar dataKey="avg" fill="hsl(var(--foreground))" radius={0} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
};

export default TopicLabAvgChart;
