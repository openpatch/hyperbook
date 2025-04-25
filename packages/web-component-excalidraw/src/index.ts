import r2wc from "@r2wc/react-to-web-component";
import { HyperbookExcalidraw } from "./HyperbookExcalidraw";
import "@excalidraw/excalidraw/index.css";

customElements.define(
  "hyperbook-excalidraw",
  r2wc(HyperbookExcalidraw, {
    props: {
      id: "string",
      lang: "string",
      autoZoom: "boolean",
      edit: "boolean",
      src: "string",
      onlinkopen: "function",
      onChange: "function",
      value: "object"
    },
  }),
);
