import { FC, Fragment } from "react";
import { deserializeState } from "./serge";
import "./index.css";

type InsertNode = {
  id: string;
  type: "InsertNode";
  followElement: Node;
};

type Placeholder = {
  type: "Placeholder";
};

type InsertCase = {
  id: string;
  text: string;
  type: "InsertCase";
  followElement: Node;
};

type InputNode = {
  id: string;
  text: string;
  type: "InputNode";
  followElement: Node;
};

type OutputNode = {
  id: string;
  text: string;
  type: "OutputNode";
  followElement: Node;
};

type BranchNode = {
  id: string;
  text: string;
  type: "BranchNode";
  followElement: Node;
  trueChild: Node;
  falseChild: Node;
};

type TaskNode = {
  id: string;
  text: string;
  type: "TaskNode";
  followElement: Node;
};

type TryCatchNode = {
  id: string;
  text: string;
  type: "TryCatchNode";
  tryChild: Node;
  catchChild: Node;
  followElement: Node;
};

type HeadLoopNode = {
  id: string;
  type: "HeadLoopNode";
  text: string;
  child: Node;
  followElement: Node;
};

type CountLoopNode = {
  id: string;
  type: "CountLoopNode";
  text: string;
  child: Node;
  followElement: Node;
};

type FunctionNode = {
  id: string;
  type: "FunctionNode";
  text: string;
  parameters: { pos: number; parName: string }[];
  child: Node;
  followElement: Node;
};

type FootLoopNode = {
  id: string;
  type: "FootLoopNode";
  text: string;
  child: Node;
  followElement: Node;
};

type CaseNode = {
  id: string;
  type: "CaseNode";
  text: string;
  cases: Node[];
  defaultOn?: boolean;
  defaultNode: Node;
  followElement: Node;
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

const InsertNode: FC<InsertNode> = ({ followElement }) => {
  return followElement && <Node {...followElement} />;
};

const Placeholder: FC<Placeholder> = () => {
  return (
    <div
      className="vcontainer columnAuto frameTopLeft"
      style={{ backgroundColor: config.Placeholder.color }}
    >
      <div className="container fixedHeight">
        <div className="placeholder symbolHeight symbol"></div>
      </div>
    </div>
  );
};

const InsertCase: FC<InsertCase> = ({ text, followElement }) => {
  return (
    <Fragment>
      <div
        className="vcontainer fixedHeight frameLeft"
        style={{ backgroundColor: config.InsertCase.color }}
      >
        <div className="fixedHeight container">
          <div className="columnAuto symbol text-center">
            <div className="padding fullHeight">
              <span>{text}</span>
            </div>
          </div>
        </div>
      </div>
      {followElement && <Node {...followElement} />}
    </Fragment>
  );
};

const InputNode: FC<InputNode> = ({ text, followElement }) => {
  return (
    <Fragment>
      <div
        className="vcontainer columnAuto frameTopLeft"
        style={{ backgroundColor: config.InputNode.color }}
      >
        <div className="fixedHeight container">
          <div className="columnAuto symbol">
            <div className="padding fullHeight">
              <span>E: {text}</span>
            </div>
          </div>
        </div>
      </div>
      {followElement && <Node {...followElement} />}
    </Fragment>
  );
};

const OutputNode: FC<OutputNode> = ({ text, followElement }) => {
  return (
    <Fragment>
      <div
        className="vcontainer columnAuto frameTopLeft"
        style={{ backgroundColor: config.OutputNode.color }}
      >
        <div className="fixedHeight container">
          <div className="columnAuto symbol">
            <div className="padding fullHeight">
              <span>A: {text}</span>
            </div>
          </div>
        </div>
      </div>
      {followElement && <Node {...followElement} />}
    </Fragment>
  );
};

const TaskNode: FC<TaskNode> = ({ followElement, text }) => {
  return (
    <Fragment>
      <div
        className="vcontainer columnAuto frameTopLeft"
        style={{ backgroundColor: config.TaskNode.color }}
      >
        <div className="fixedHeight container">
          <div className="columnAuto symbol">
            <div className="padding fullHeight">
              <span>{text}</span>
            </div>
          </div>
        </div>
      </div>
      {followElement && <Node {...followElement} />}
    </Fragment>
  );
};

const BranchNode: FC<BranchNode> = ({
  text,
  followElement,
  falseChild,
  trueChild,
}) => {
  return (
    <Fragment>
      <div
        className="vcontainer columnAuto frameTopLeft"
        style={{ backgroundColor: config.BranchNode.color }}
      >
        <div className="columnAuto vcontainer">
          <div className="branchSplit vcontainer fixedDoubleHeight">
            <div className="fixedHeight container">
              <div className="columnAuto symbol text-center">
                <div className="padding fullHeight">
                  <span>{text}</span>
                </div>
              </div>
            </div>
            <div className="fixedHeight container padding">
              <div className="columnAuto text-left bottomHeader">Wahr</div>
              <div className="columnAuto text-right bottomHeader">Falsch</div>
            </div>
          </div>
          <div className="columnAuto branchCenter container">
            <div className="columnAuto vcontainer ov-hidden">
              {trueChild && <Node {...trueChild} />}
            </div>
            <div className="columnAuto vcontainer ov-hidden">
              {falseChild && <Node {...falseChild} />}
            </div>
          </div>
        </div>
      </div>
      {followElement && <Node {...followElement} />}
    </Fragment>
  );
};

const TryCatchNode: FC<TryCatchNode> = ({
  tryChild,
  catchChild,
  followElement,
  text,
}) => {
  return (
    <Fragment>
      <div
        className="vcontainer columnAuto frameTopLeft"
        style={{ backgroundColor: config.TryCatchNode.color }}
      >
        <div className="columnAuto vcontainer tryCatchNode">
          <div className="container fixedHeight padding">
            <div className="symbol">Try</div>
          </div>
          <div className="columnAuto container loopShift">
            <div className="loopWidth vcontainer">
              {tryChild && <Node {...tryChild} />}
            </div>
          </div>
          <div className="columnAuto container loopShift">
            <div className="loopWidth vcontainer">
              <div
                className="frameLeftBottom"
                style={{
                  flex: "0 0 3px",
                }}
              ></div>
            </div>
          </div>
        </div>
        <div className="container fixedHeight padding tryCatchNode">
          <div className="symbol">Catch</div>
          <div className="columnAuto symbol">
            <div className="padding fullHeight">
              <span>{text}</span>
            </div>
          </div>
        </div>
        <div className="columnAuto container loopShift">
          <div className="loopWidth vcontainer">
            {catchChild && <Node {...catchChild} />}
          </div>
        </div>
      </div>
      {followElement && <Node {...followElement} />}
    </Fragment>
  );
};

const HeadLoopNode: FC<HeadLoopNode> = ({ followElement, text, child }) => {
  return (
    <div
      className="vcontainer columnAuto frameTopLeft"
      style={{ backgroundColor: config.CountLoopNode.color }}
    >
      <div className="columnAuto vcontainer">
        <div className="container fixedHeight">
          <div className="columnAuto symbol">
            <div className="padding fullHeight">
              <span>{text}</span>
            </div>
          </div>
        </div>
        <div className="columnAuto container loopShift">
          <div className="loopWidth frameLeft vcontainer">
            {child && <Node {...child} />}
          </div>
        </div>
        {followElement && <Node {...followElement} />}
      </div>
    </div>
  );
};

const CountLoopNode: FC<CountLoopNode> = ({ followElement, text, child }) => {
  return (
    <div
      className="vcontainer columnAuto frameTopLeft"
      style={{ backgroundColor: config.CountLoopNode.color }}
    >
      <div className="columnAuto vcontainer">
        <div className="container fixedHeight">
          <div className="columnAuto symbol">
            <div className="padding fullHeight">
              <span>{text}</span>
            </div>
          </div>
        </div>
        <div className="columnAuto container loopShift">
          <div className="loopWidth frameLeft vcontainer">
            {child && <Node {...child} />}
          </div>
        </div>
        {followElement && <Node {...followElement} />}
      </div>
    </div>
  );
};

const FunctionNode: FC<FunctionNode> = ({
  followElement,
  child,
  text,
  parameters,
}) => {
  return (
    <Fragment>
      <div
        className="vcontainer columnAuto frameTopLeft"
        style={{ backgroundColor: config.FunctionNode.color }}
      >
        <div className="columnAuto vcontainer">
          <div
            className="fixedHeight func-box-header padding"
            style={{
              display: "flex",
              flexDirection: "row",
              paddingTop: "6.5px",
            }}
          >
            function
            <div style={{ marginRight: "2ch" }}></div>
            <div className="function-elem">
              <div className="func-header-text-div">
                {text} ({parameters.map((p) => p.parName).join(", ")}) {`{`}
              </div>
            </div>
          </div>
          <div className="columnAuto container loopShift">
            <div className="loopWidth vcontainer">
              {child && <Node {...child} />}
            </div>
          </div>
          <div className="columnAuto container loopShift">
            <div className="loopWidth vcontainer">
              <div
                className="frameLeftBottom"
                style={{ flex: "0 0 3px" }}
              ></div>
            </div>
          </div>
          <div className="container fixedHeight padding">
            <div className="symbol">{`}`}</div>
          </div>
        </div>
      </div>
      {followElement && <Node {...followElement} />}
    </Fragment>
  );
};

const FootLoopNode: FC<FootLoopNode> = ({ child, followElement, text }) => {
  return (
    <Fragment>
      <div
        className="vcontainer columnAuto frameTopLeft"
        style={{ backgroundColor: config.FootLoopNode.color }}
      >
        <div className="columnAuto vcontainer">
          <div className="columnAuto container loopShift">
            <div className="loopWidth frameLeftBottom vcontainer">
              {child && <Node {...child} />}
              <div className="borderHeight" />
            </div>
          </div>
          <div className="container fixedHeight">
            <div className="columnAuto symbol">
              <div className="padding fullHeight">
                <span>{text}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {followElement && <Node {...followElement} />}
    </Fragment>
  );
};

const CaseNode: FC<CaseNode> = ({
  defaultOn,
  cases,
  text,
  defaultNode,
  followElement,
}) => {
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
  return (
    <Fragment>
      <div
        className="vcontainer columnAuto frameTopLeft"
        style={{ backgroundColor: config.CaseNode.color }}
      >
        <div className="columnAuto vcontainer">
          <div
            className={headClassNames.join(" ")}
            style={{ backgroundPosition: "1px 0px" }}
          >
            <div className="columnAuto symbol">
              <div className="padding fullHeight">
                <span
                  style={{
                    marginLeft: `calc(${
                      (nrCases / (nrCases + 1)) * 100
                    }% - 2em)`,
                  }}
                >
                  {text}
                </span>
              </div>
            </div>
          </div>
          <div className={bodyClassNames.join(" ")}>
            {cases.map((c, i) => (
              <div key={i} className="columnAuto vcontainer ov-hidden">
                <Node {...c} />
              </div>
            ))}
            <div className="columnAuto vcontainer ov-hidden">
              <Node {...defaultNode} />
            </div>
          </div>
        </div>
      </div>
      {followElement && <Node {...followElement} />}
    </Fragment>
  );
};

const Node: FC<Node> = (props) => {
  switch (props.type) {
    case "FootLoopNode":
      return <FootLoopNode {...props} />;
    case "HeadLoopNode":
      return <HeadLoopNode {...props} />;
    case "InputNode":
      return <InputNode {...props} />;
    case "InsertCase":
      return <InsertCase {...props} />;
    case "CaseNode":
      return <CaseNode {...props} />;
    case "FunctionNode":
      return <FunctionNode {...props} />;
    case "CountLoopNode":
      return <CountLoopNode {...props} />;
    case "TryCatchNode":
      return <TryCatchNode {...props} />;
    case "BranchNode":
      return <BranchNode {...props} />;
    case "TaskNode":
      return <TaskNode {...props} />;
    case "Placeholder":
      return <Placeholder {...props} />;
    case "OutputNode":
      return <OutputNode {...props} />;
    case "InsertNode":
      return <InsertNode {...props} />;
  }
};

type State = {
  model: Node;
  width: number;
  height: number;
};

type DirectiveStruktogProps = {
  data: string;
};

const DirectiveStruktog: FC<DirectiveStruktogProps> = ({ data }) => {
  try {
    data = data.replace(new RegExp("https://struktog.openpatch.org/?#"), "");
    const state = deserializeState<State>(data);

    return (
      <div className="element-struktog">
        <a href={`https://struktog.openpatch.org/#${data}`} target="_blank">
          <div className="columnAuto container">
            <div className="columnAuto">
              {state?.model && <Node {...state.model} />}
              <div className="frameTop borderHeight"></div>
            </div>
            <div className="frameLeft borderWidth"></div>
          </div>
        </a>
      </div>
    );
  } catch (e) {
    return (
      <div className="element-struktog">
        <div className="error">
          We can not parse the provided data. Please check if it is correct.
        </div>
      </div>
    );
  }
};

export default {
  directives: { struktog: DirectiveStruktog },
};
