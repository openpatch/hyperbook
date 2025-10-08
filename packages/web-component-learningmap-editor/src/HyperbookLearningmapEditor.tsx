import {
  ReactFlowProvider,
} from "@xyflow/react";
import { LearningMapEditor } from "./LearningMapEditor";
import { RoadmapData } from "./types";

export function HyperbookLearningmapEditor({
  roadmapData,
  language
}: {
  roadmapData: string | RoadmapData;
  language?: string;
}) {
  return (
    <ReactFlowProvider>
      <LearningMapEditor
        language={language}
        roadmapData={roadmapData}
      />
    </ReactFlowProvider>
  );
}
