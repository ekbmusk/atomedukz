import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useLang } from "@/i18n/LanguageContext";
import { useWeeklyActivity } from "@/hooks/useTeacherAnalytics";
import { ChartShell } from "./TopicCorrectChart";

const WeeklyActivityChart = () => {
  const { t } = useLang();
  const { data, isLoading } = useWeeklyActivity(8);

  if (isLoading || !data || data.length === 0) {
    return (
      <ChartShell title={t.dashboard.analyticsTitleWeekly}>
        <div className="py-8 text-center label-mono text-[11px] text-muted-foreground">
          {isLoading ? t.topics.loading : t.dashboard.analyticsEmpty}
        </div>
      </ChartShell>
    );
  }

  const chartData = data.map((d) => ({
    week: new Date(d.week_start).toLocaleDateString("kk-KZ", { day: "2-digit", month: "2-digit" }),
    problems: d.problems_count,
    labs: d.labs_count,
  }));

  return (
    <ChartShell title={t.dashboard.analyticsTitleWeekly}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={10} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              fontSize: 11,
            }}
            cursor={{ fill: "hsl(var(--muted))" }}
          />
          <Legend
            iconType="square"
            wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
          />
          <Bar dataKey="problems" name={t.dashboard.analyticsLegendProblems} stackId="a" fill="hsl(var(--primary))" />
          <Bar dataKey="labs" name={t.dashboard.analyticsLegendLabs} stackId="a" fill="hsl(var(--foreground))" />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
};

export default WeeklyActivityChart;
