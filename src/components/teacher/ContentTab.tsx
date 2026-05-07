import { useState, useMemo } from "react";
import { useLang } from "@/i18n/LanguageContext";
import { useTopics } from "@/hooks/useTopics";
import ProblemsCRUD from "./ProblemsCRUD";
import VideosCRUD from "./VideosCRUD";
import LabEditor from "./LabEditor";

type SubTab = "problems" | "lab" | "videos";

const ContentTab = () => {
  const { t } = useLang();
  const { data: topics, isLoading } = useTopics();
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [sub, setSub] = useState<SubTab>("problems");

  const selected = useMemo(
    () => topics?.find((tt) => tt.week_number === weekNumber) ?? null,
    [topics, weekNumber],
  );

  if (isLoading) {
    return (
      <div className="label-mono text-[11px] text-muted-foreground text-center py-12">
        {t.topics.loading}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Topic selector */}
      <div className="border border-border p-4 flex flex-col md:flex-row md:items-center gap-3">
        <span className="label-mono text-[10px] text-muted-foreground">
          {t.dashboard.contentSelectTopic}
        </span>
        <select
          value={weekNumber}
          onChange={(e) => setWeekNumber(Number(e.target.value))}
          className="bg-background border border-border focus:border-primary outline-none px-3 py-2 text-sm font-light flex-1 min-w-0 transition-colors"
        >
          {(topics ?? []).map((tt) => (
            <option key={tt.id} value={tt.week_number}>
              {String(tt.week_number).padStart(2, "0")} — {tt.title_kz}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-px bg-border">
            {(["problems", "lab", "videos"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSub(key)}
                className={`flex-1 py-3 px-4 label-mono text-[11px] transition-colors ${
                  sub === key
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {key === "problems"
                  ? t.dashboard.contentEntityProblems
                  : key === "lab"
                    ? t.dashboard.contentEntityLab
                    : t.dashboard.contentEntityVideos}
              </button>
            ))}
          </div>

          {/* Sub-tab content */}
          <div>
            {sub === "problems" && <ProblemsCRUD topicId={selected.id} weekNumber={selected.week_number} />}
            {sub === "videos" && <VideosCRUD topicId={selected.id} weekNumber={selected.week_number} />}
            {sub === "lab" && <LabEditor topicId={selected.id} weekNumber={selected.week_number} />}
          </div>
        </>
      )}
    </div>
  );
};

export default ContentTab;
