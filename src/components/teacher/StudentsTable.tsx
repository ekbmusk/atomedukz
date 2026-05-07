import { motion } from "framer-motion";
import { useLang } from "@/i18n/LanguageContext";
import type { StudentRow } from "@/hooks/useTeacherDashboard";

interface StudentsTableProps {
  students: StudentRow[];
}

const StudentsTable = ({ students }: StudentsTableProps) => {
  const { t } = useLang();

  if (students.length === 0) {
    return (
      <div className="border border-border p-12 text-center">
        <p className="label-mono text-[11px] text-muted-foreground">{t.dashboard.studentsEmpty}</p>
      </div>
    );
  }

  return (
    <div className="border border-border">
      {/* Header */}
      <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-border bg-card/30 label-mono text-[10px] text-muted-foreground">
        <span className="col-span-1">#</span>
        <span className="col-span-6">{t.dashboard.studentName}</span>
        <span className="col-span-2 text-right">{t.dashboard.studentSolved}</span>
        <span className="col-span-2 text-right">{t.dashboard.studentLabs}</span>
        <span className="col-span-1 text-right">{t.dashboard.studentAvg}</span>
      </div>

      {students.map((s, i) => {
        const correctPct =
          s.attempts_total > 0
            ? Math.round((s.attempts_correct / s.attempts_total) * 100)
            : null;

        return (
          <motion.div
            key={s.user_id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: i * 0.02 }}
            className="grid grid-cols-12 gap-3 px-5 py-4 border-b border-border last:border-b-0 items-center hover:bg-card/20 transition-colors"
          >
            <span className="col-span-1 label-mono text-[10px] text-muted-foreground tabular">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="col-span-6 font-light text-foreground/95 truncate">{s.full_name}</span>
            <div className="col-span-2 text-right">
              <div className="font-display tabular text-sm text-foreground">
                {s.attempts_correct}
                <span className="text-muted-foreground/60">/{s.attempts_total}</span>
              </div>
              {correctPct !== null && (
                <div className="label-mono text-[9px] text-muted-foreground tabular">
                  {correctPct}%
                </div>
              )}
            </div>
            <div className="col-span-2 text-right">
              <div className="font-display tabular text-sm text-foreground">
                {s.labs_submitted}
              </div>
            </div>
            <div className="col-span-1 text-right">
              <div className={`font-display tabular text-sm ${
                s.labs_avg_score == null ? "text-muted-foreground/50" :
                s.labs_avg_score >= 70 ? "text-primary" : "text-foreground"
              }`}>
                {s.labs_avg_score ?? "—"}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default StudentsTable;
