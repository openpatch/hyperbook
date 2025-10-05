import r2wc from "@r2wc/react-to-web-component";
import { HyperbookLearningmap } from "./HyperbookLearningmap";
import "@xyflow/react/dist/style.css";
import "./index.css";

// Custom wrapper to dispatch 'change' event
const LearningmapWC = r2wc(HyperbookLearningmap, {
  props: {
    roadmapData: "string",
    nodeState: "json",
    language: "string",
    x: "number",
    y: "number",
    zoom: "number",
  },
  events: {
    change: true,
  },
});

customElements.define("hyperbook-learningmap", LearningmapWC);
