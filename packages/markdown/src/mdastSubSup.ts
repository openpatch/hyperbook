import type { Extension as MdastExtension } from "mdast-util-from-markdown";
import type { PhrasingContent } from "mdast";

export interface Sub {
  type: "sub";
  children: PhrasingContent[];
}

export interface Sup {
  type: "sup";
  children: PhrasingContent[];
}

const mdastSubSup: MdastExtension = {
  enter: {
    sub(token) {
      this.enter({ type: "sub", children: [] } as any, token);
    },
    sup(token) {
      this.enter({ type: "sup", children: [] } as any, token);
    },
    // Handle the text content inside sub/sup
    subText(token) {
      this.enter({ type: "text", value: this.sliceSerialize(token) }, token);
    },
    supText(token) {
      this.enter({ type: "text", value: this.sliceSerialize(token) }, token);
    },
  },
  exit: {
    sub(token) {
      this.exit(token);
    },
    sup(token) {
      this.exit(token);
    },
    subText(token) {
      this.exit(token);
    },
    supText(token) {
      this.exit(token);
    },
  },
};

export default mdastSubSup;
