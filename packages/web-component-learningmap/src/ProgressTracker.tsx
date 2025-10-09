import { CheckCircle } from "lucide-react";
import StarCircle from "./icons/StarCircle";
import { getTranslations } from "./translations";

export const ProgressTracker = ({ completed, mastered, total, language = "en" }: { completed: number; mastered: number; total: number; language?: string }) => {
  const t = getTranslations(language);
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <>
      <span className="completed-counter" title={t.completedTitle} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <CheckCircle />
        {completed} / {total}
      </span>
      <div className="progress-bar-container">
        <span className="progress-value">{progress.toFixed(0)}%</span>
        <div className="progress-bar-fill" style={{ width: `${progress}%` }}>
        </div>
      </div>
      <span className="mastered-counter" title={t.masteredTitle} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <StarCircle />
        {mastered}
      </span>
    </>
  );
}

