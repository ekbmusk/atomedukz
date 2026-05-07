import TopicCorrectChart from "./TopicCorrectChart";
import TopicLabAvgChart from "./TopicLabAvgChart";
import WeeklyActivityChart from "./WeeklyActivityChart";
import StuckStudentsList from "./StuckStudentsList";

const AnalyticsTab = ({ onPickStudent }: { onPickStudent?: (userId: string) => void }) => (
  <div className="space-y-6">
    <TopicCorrectChart />
    <TopicLabAvgChart />
    <WeeklyActivityChart />
    <StuckStudentsList onPickStudent={onPickStudent} />
  </div>
);

export default AnalyticsTab;
