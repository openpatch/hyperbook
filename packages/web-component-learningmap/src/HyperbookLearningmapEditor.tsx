import {
  ReactFlowProvider,
} from "@xyflow/react";
import { LearningMapEditor } from "./LearningMapEditor";
import { RoadmapData } from "./types";

export function HyperbookLearningmapEditor({
  roadmapData,
  language,
  onChange
}: {
  roadmapData: string | RoadmapData;
  language?: string;
  onChange?: (data: RoadmapData) => void;
}) {
  return (
    <div className="hyperbook-learningmap-container">
      <ReactFlowProvider>
        <LearningMapEditor
          language={language}
          roadmapData={roadmapData}
          onChange={onChange}
        />
      </ReactFlowProvider>
    </div>
  );
}
