import r2wc from "@r2wc/react-to-web-component";
import { HyperbookLearningmapEditor } from "./HyperbookLearningmapEditor";
import "@xyflow/react/dist/style.css";
import "./index.css";

const LearningmapEditorWC = r2wc(HyperbookLearningmapEditor, {
  props: {
    roadmapData: "string",
    language: "string",
  },
  events: {
    change: true,
  },
});

customElements.define("hyperbook-learningmap-editor", LearningmapEditorWC);
