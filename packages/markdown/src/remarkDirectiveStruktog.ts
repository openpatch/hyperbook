// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { deserializeState } from "./serge";
import { ElementContent } from "hast";

type InsertNode = {
  id: string;
  type: "InsertNode";
  followElement?: Node;
};

type Placeholder = {
  type: "Placeholder";
};

type InsertCase = {
  id: string;
  text: string;
  type: "InsertCase";
  followElement?: Node;
};

type InputNode = {
  id: string;
  text: string;
  type: "InputNode";
  followElement?: Node;
};

type OutputNode = {
  id: string;
  text: string;
  type: "OutputNode";
  followElement?: Node;
};

type BranchNode = {
  id: string;
  text: string;
  type: "BranchNode";
  followElement?: Node;
  trueChild?: Node;
  falseChild?: Node;
};

type TaskNode = {
  id: string;
  text: string;
  type: "TaskNode";
  followElement?: Node;
};

type TryCatchNode = {
  id: string;
  text: string;
  type: "TryCatchNode";
  tryChild?: Node;
  catchChild?: Node;
  followElement?: Node;
};

type HeadLoopNode = {
  id: string;
  type: "HeadLoopNode";
  text: string;
  child?: Node;
  followElement?: Node;
};

type CountLoopNode = {
  id: string;
  type: "CountLoopNode";
  text: string;
  child?: Node;
  followElement?: Node;
};

type FunctionNode = {
  id: string;
  type: "FunctionNode";
  text: string;
  parameters: { pos: number; parName: string }[];
  child?: Node;
  followElement?: Node;
};

type FootLoopNode = {
  id: string;
  type: "FootLoopNode";
  text: string;
  child?: Node;
  followElement?: Node;
};

type CaseNode = {
  id: string;
  type: "CaseNode";
  text: string;
  cases: Node[];
  defaultOn?: boolean;
  defaultNode?: Node;
  followElement?: Node;
};

type Node =
  | InsertNode
  | Placeholder
  | InsertCase
  | InputNode
  | OutputNode
  | TaskNode
  | BranchNode
  | TryCatchNode
  | HeadLoopNode
  | CountLoopNode
  | FunctionNode
  | FootLoopNode
  | CaseNode;

const config: Record<Node["type"], { color: string }> = {
  InsertNode: {
    color: "rgb(255,255,243)",
  },
  Placeholder: {
    color: "rgb(255,255,243)",
  },
  InsertCase: {
    color: "rgb(250, 218, 209)",
  },
  InputNode: {
    color: "rgb(253, 237, 206)",
  },
  OutputNode: {
    color: "rgb(253, 237, 206)",
  },
  TaskNode: {
    color: "rgb(253, 237, 206)",
  },
  CountLoopNode: {
    color: "rgb(220, 239, 231)",
  },
  HeadLoopNode: {
    color: "rgb(220, 239, 231)",
  },
  FootLoopNode: {
    color: "rgb(220, 239, 231)",
  },
  BranchNode: {
    color: "rgb(250, 218, 209)",
  },
  CaseNode: {
    color: "rgb(250, 218, 209)",
  },
  FunctionNode: {
    color: "rgb(255, 255, 255)",
  },
  TryCatchNode: {
    color: "rgb(250, 218, 209)",
  },
};

type State = {
  model: Node;
  width: number;
  height: number;
};

const makeInsertNode = ({ followElement }: InsertNode): ElementContent[] => {
  if (followElement) {
    return makeNode(followElement);
  }
  return [];
};

const makePlaceholder = (): ElementContent[] => {
  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "vcontainer columnAuto frameTopLeft",
        style: `background-color: ${config.Placeholder.color};`,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "container fixedHeight",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "placeholder symbolHeight symbol",
              },
              children: [],
            },
          ],
        },
      ],
    },
  ];
};

const makeInsertCase = ({
  text,
  followElement,
}: InsertCase): ElementContent[] => {
  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "vcontainer fixedHeight frameLeft",
        style: `background-color: ${config.InsertCase.color}`,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "fixedHeight container",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "columnAuto symbol text-center",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "padding fullHeight",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "span",
                      properties: {},
                      children: [
                        {
                          type: "text",
                          value: text,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    ...(followElement ? makeNode(followElement) : []),
  ];
};

const makeInputNode = ({
  text,
  followElement,
}: InputNode): ElementContent[] => {
  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "vcontainer columnAuto frameTopLeft",
        style: `background-color: ${config.InputNode.color}`,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "fixedHeight container",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "columnAuto symbol",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "padding fullHeight",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "span",
                      properties: {},
                      children: [
                        {
                          type: "text",
                          value: "E: " + text,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    ...(followElement ? makeNode(followElement) : []),
  ];
};

const makeOutputNode = ({
  text,
  followElement,
}: OutputNode): ElementContent[] => {
  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "vcontainer columnAuto frameTopLeft",
        style: `background-color: ${config.OutputNode.color}`,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "fixedHeight container",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "columnAuto symbol",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "padding fullHeight",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "span",
                      properties: {},
                      children: [
                        {
                          type: "text",
                          value: "A: " + text,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    ...(followElement ? makeNode(followElement) : []),
  ];
};

const makeTaskNode = ({ text, followElement }: TaskNode): ElementContent[] => {
  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "vcontainer columnAuto frameTopLeft",
        style: `background-color: ${config.TaskNode.color}`,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "fixedHeight container",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "columnAuto symbol",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "padding fullHeight",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "span",
                      properties: {},
                      children: [
                        {
                          type: "text",
                          value: text,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    ...(followElement ? makeNode(followElement) : []),
  ];
};

const makeBranchNode = ({
  text,
  followElement,
  trueChild,
  falseChild,
}: BranchNode): ElementContent[] => {
  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "vcontainer columnAuto frameTopLeft",
        style: `background-color: ${config.BranchNode.color}`,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "columnAuto vcontainer",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "branchSplit vcontainer fixedDoubleHeight",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "fixedHeight container",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "columnAuto symbol text-center",
                      },
                      children: [
                        {
                          type: "element",
                          tagName: "div",
                          properties: {
                            class: "padding fullHeight",
                          },
                          children: [
                            {
                              type: "element",
                              tagName: "span",
                              properties: {},
                              children: [
                                {
                                  type: "text",
                                  value: text,
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "fixedHeight container padding",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "columnAuto text-left bottomHeader",
                      },
                      children: [
                        {
                          type: "text",
                          value: "Wahr",
                        },
                      ],
                    },
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "columnAuto text-right bottomHeader",
                      },
                      children: [
                        {
                          type: "text",
                          value: "Falsch",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "columnAuto branchCenter container",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "columnAuto vcontainer ov-hidden",
                  },
                  children: trueChild ? makeNode(trueChild) : [],
                },
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "columnAuto vcontainer ov-hidden",
                  },
                  children: falseChild ? makeNode(falseChild) : [],
                },
              ],
            },
          ],
        },
      ],
    },
    ...(followElement ? makeNode(followElement) : []),
  ];
};

const makeTryCatchNode = ({
  tryChild,
  catchChild,
  followElement,
  text,
}: TryCatchNode): ElementContent[] => {
  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "vcontainer columnAuto frameTopLeft",
        style: `background-color: ${config.TryCatchNode.color}`,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "columnAuto vcontainer tryCatchNode",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "container fixedHeight padding",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "symbol",
                  },
                  children: [
                    {
                      type: "text",
                      value: "Try",
                    },
                  ],
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "columnAuto container loopShift",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "loopWidth vcontainer",
                  },
                  children: tryChild ? makeNode(tryChild) : [],
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "columnAuto container loopShift",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "loopWidth vcontainer",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "frameLeftBottom",
                        style: `flex: 0 0 3px;`,
                      },
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "container fixedHeight padding tryCatchNode",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "symbol",
              },
              children: [
                {
                  type: "text",
                  value: "Catch",
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "columnAuto symbol",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "padding fullHeight",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "span",
                      properties: {},
                      children: [
                        {
                          type: "text",
                          value: text,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "columnAuto container loopShift",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "loopWidth vcontainer",
              },
              children: catchChild ? makeNode(catchChild) : [],
            },
          ],
        },
      ],
    },
    ...(followElement ? makeNode(followElement) : []),
  ];
};

const makeHeadLoopNode = ({
  followElement,
  text,
  child,
}: HeadLoopNode): ElementContent[] => {
  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "vcontainer columnAuto frameTopLeft",
        style: `background-color: ${config.CountLoopNode.color}`,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "columnAuto vcontainer",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "container fixedHeight",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "columnAuto symbol",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "padding fullHeight",
                      },
                      children: [
                        {
                          type: "element",
                          tagName: "span",
                          properties: {},
                          children: [
                            {
                              type: "text",
                              value: text,
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "columnAuto container loopShift",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "loopWidth frameLeft vcontainer",
              },
              children: child ? makeNode(child) : [],
            },
          ],
        },
        ...(followElement ? makeNode(followElement) : []),
      ],
    },
  ];
};

const makeCountLoopNode = ({
  followElement,
  text,
  child,
}: CountLoopNode): ElementContent[] => {
  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "vcontainer columnAuto frameTopLeft",
        style: `background-color: ${config.CountLoopNode.color}`,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "columnAuto vcontainer",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "container fixedHeight",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "columnAuto symbol",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "padding fullHeight",
                      },
                      children: [
                        {
                          type: "element",
                          tagName: "span",
                          properties: {},
                          children: [
                            {
                              type: "text",
                              value: text,
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "columnAuto container loopShift",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "loopWidth frameLeft vcontainer",
                  },
                  children: child ? makeNode(child) : [],
                },
              ],
            },
            ...(followElement ? makeNode(followElement) : []),
          ],
        },
      ],
    },
  ];
};

const makeFunctionNode = ({
  followElement,
  child,
  text,
  parameters,
}: FunctionNode): ElementContent[] => {
  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "vcontainer columnAuto frameTopLeft",
        style: `background-color: ${config.FunctionNode.color}`,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "columnAuto vcontainer",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "fixedHeight func-box-header padding",
                style:
                  "display: flex; flex-direction: row; padding-top: 6.5px;",
              },
              children: [
                {
                  type: "text",
                  value: "function",
                },
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    style: "margin-right: 2ch",
                  },
                  children: [],
                },
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "function-elem",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "func-header-text-div",
                      },
                      children: [
                        {
                          type: "text",
                          value: `${text} ${parameters.map((p) => p.parName).join(", ")} {`,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "columnAuto container loopShift",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "loopWidth vcontainer",
                  },
                  children: child ? makeNode(child) : [],
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "columnAuto container loopShift",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "loopWidth vcontainer",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "frameLeftBottom",
                        style: `flex: 0 0 3px;`,
                      },
                      children: [],
                    },
                  ],
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "container fixedHeight padding",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "symbol",
                  },
                  children: [
                    {
                      type: "text",
                      value: "}",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    ...(followElement ? makeNode(followElement) : []),
  ];
};

const makeFootLoopNode = ({
  followElement,
  text,
  child,
}: FootLoopNode): ElementContent[] => {
  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "vcontainer columnAuto frameTopLeft",
        style: `background-color: ${config.FootLoopNode.color};`,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "columnAuto vcontainer",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "columnAuto container loopShift",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "loopWidth frameLeftBottom vcontainer",
                  },
                  children: [
                    ...(child ? makeNode(child) : []),
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "borderHeight",
                      },
                      children: [],
                    },
                  ],
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "container fixedHeight",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "columnAuto symbol",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "padding fullHeight",
                      },
                      children: [
                        {
                          type: "element",
                          tagName: "span",
                          properties: {},
                          children: [
                            {
                              type: "text",
                              value: text,
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    ...(followElement ? makeNode(followElement) : []),
  ];
};

const makeCaseNode = ({
  defaultOn,
  cases,
  text,
  defaultNode,
  followElement,
}: CaseNode): ElementContent[] => {
  const headClassNames = ["vcontainer", "fixedHeight"];
  const bodyClassNames = ["columnAuto", "container"];

  let nrCases = cases.length;
  if (defaultOn) {
    headClassNames.push(`caseHead-${nrCases}`);
    bodyClassNames.push(`caseBody-${nrCases}`);
  } else {
    headClassNames.push(`caseHead-noDefault-${nrCases}`);
    bodyClassNames.push(`caseBody-${nrCases - 1}`);
    nrCases = nrCases + 2;
  }

  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "vcontainer columnAuto frameTopLeft",
        style: `background-color: ${config.CaseNode.color}`,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "columnAuto vcontainer",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: headClassNames.join(" "),
                style: `background-position: 1px 0px`,
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "columnAuto symbol",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "padding fullHeight",
                      },
                      children: [
                        {
                          type: "element",
                          tagName: "span",
                          properties: {
                            style: `margin-left: calc(${(nrCases / (nrCases + 1)) * 100}% - 2em)`,
                          },
                          children: [
                            {
                              type: "text",
                              value: text,
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                class: bodyClassNames.join(" "),
              },
              children: [
                ...cases.map(
                  (c) =>
                    ({
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "columnAuto vcontainer ov-hidden",
                      },
                      children: makeNode(c),
                    }) as ElementContent,
                ),
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "columnAuto vcontainer ov-hidden",
                  },
                  children: defaultNode ? makeNode(defaultNode) : [],
                },
              ],
            },
          ],
        },
      ],
    },
    ...(followElement ? makeNode(followElement) : []),
  ];
};

const makeNode = (node: Node): ElementContent[] => {
  switch (node.type) {
    case "FootLoopNode": {
      return makeFootLoopNode(node);
    }
    case "HeadLoopNode": {
      return makeHeadLoopNode(node);
    }
    case "InputNode": {
      return makeInputNode(node);
    }
    case "InsertCase": {
      return makeInsertCase(node);
    }
    case "CaseNode": {
      return makeCaseNode(node);
    }
    case "FunctionNode": {
      return makeFunctionNode(node);
    }
    case "CountLoopNode": {
      return makeCountLoopNode(node);
    }
    case "TryCatchNode": {
      return makeTryCatchNode(node);
    }
    case "BranchNode": {
      return makeBranchNode(node);
    }
    case "TaskNode": {
      return makeTaskNode(node);
    }
    case "Placeholder": {
      return makePlaceholder();
    }
    case "OutputNode": {
      return makeOutputNode(node);
    }
    case "InsertNode": {
      return makeInsertNode(node);
    }
  }
};

export default (ctx: HyperbookContext) => () => {
  const name = "struktog";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectLeafDirective(node, file, name);
        registerDirective(file, name, [], ["style.css"]);

        const { data: stRawData = "" } = node.attributes || {};
        const stData = (stRawData || "").replace(
          new RegExp("https://struktog.openpatch.org/?#"),
          "",
        );
        const state = deserializeState<State>(stData);
        if (!state) return;

        data.hName = "div";
        data.hProperties = {
          class: "directive-struktog",
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "a",
            properties: {
              href: `https://struktog.openpatch.org/#${stData}`,
              target: "_blank",
            },
            children: [
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "columnAuto container",
                },
                children: [
                  {
                    type: "element",
                    tagName: "div",
                    properties: {
                      class: "columnAuto",
                    },
                    children: [
                      ...makeNode(state.model),
                      {
                        type: "element",
                        tagName: "div",
                        properties: {
                          class: "frameTop borderHeight",
                        },
                        children: [],
                      },
                    ],
                  },
                  {
                    type: "element",
                    tagName: "div",
                    properties: {
                      class: "borderWidth frameLeft",
                    },
                    children: [],
                  },
                ],
              },
            ],
          },
        ];
      }
    });
  };
};
