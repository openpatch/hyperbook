import { CheckCircle } from "lucide-react";
import StarCircle from "./icons/StarCircle";

export const ProgressTracker = ({ completed, mastered, total }: { completed: number; mastered: number; total: number }) => {
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <>
      <span className="completed-counter" title="Completed" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <CheckCircle />
        {completed} / {total}
      </span>
      <div className="progress-bar-container">
        <span className="progress-value">{progress}%</span>
        <div className="progress-bar-fill" style={{ width: `${progress}%` }}>
        </div>
      </div>
      <span className="mastered-counter" title="Mastered" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <StarCircle />
        {mastered}
      </span>
    </>
  );
}

