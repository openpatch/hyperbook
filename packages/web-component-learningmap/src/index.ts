import r2wc from "@r2wc/react-to-web-component";
import { HyperbookLearningmap } from "./HyperbookLearningmap";
import "@xyflow/react/dist/style.css";
import "./index.css";
import { HyperbookLearningmapEditor } from "./HyperbookLearningmapEditor";

const LearningmapWC = r2wc(HyperbookLearningmap, {
  props: {
    roadmapData: "string",
    language: "string",
    onChange: "function",
    initialState: "json",
  },
  events: {
    change: true,
  },
});

customElements.define("hyperbook-learningmap", LearningmapWC);

const LearningmapEditorWC = r2wc(HyperbookLearningmapEditor, {
  props: {
    roadmapData: "string",
    language: "string",
    onChange: "function",
  },
  events: {
    change: true,
  },
});

customElements.define("hyperbook-learningmap-editor", LearningmapEditorWC);
