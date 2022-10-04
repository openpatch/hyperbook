import { Flow as IFlow } from "@bitflow/core";
import { FC, lazy, Suspense, useEffect, useState } from "react";
import { createSlice } from "@hyperbook/store";
import { useFile, useMakeUrl } from "@hyperbook/provider";
import "./index.css";

type DirectiveFlowProps = {
  src: string;
  height?: number;
};

const Flow = lazy(() => import("./Flow"));
const Task = lazy(() => import("./Task"));

const Loading = () => {
  return <div className="loading">...</div>;
};

const DirectiveFlow: FC<DirectiveFlowProps> = ({ src, height = 400 }) => {
  const makeUrl = useMakeUrl();
  const [loadFile] = useFile();
  const [flow, setFlow] = useState<IFlow>();
  const [err, setErr] = useState<string>();

  if (!src) {
    setErr('You need to provide a src like so: ::flow{src="/flow.json"}');
  }

  useEffect(() => {
    const url = makeUrl(src, "public");
    loadFile(url)
      .then((r) => JSON.parse(r))
      .then(setFlow)
      .catch(() => {
        setErr(`Could not find a flow at ${src}. Please check the src.`);
      });
  }, [src]);

  if (err) {
    return <pre className="element-bitflow">{err}</pre>;
  }

  return (
    <div className="element-bitflow" style={{ height }}>
      <Suspense fallback={<Loading />}>
        {flow ? <Flow flow={flow} /> : <Loading />}
      </Suspense>
    </div>
  );
};

type DirectiveTaskProps = {
  src: string;
  height?: number;
};

const DirectiveTask: FC<DirectiveTaskProps> = ({ src, height = 400 }) => {
  const makeUrl = useMakeUrl();
  const [loadFile] = useFile();
  const [task, setTask] = useState<any>();
  const [err, setErr] = useState<string>();

  if (!src) {
    setErr('You need to provide a src like so: ::task{src="/task.json"}');
  }

  useEffect(() => {
    const url = makeUrl(src, "public");
    loadFile(url)
      .then((r) => JSON.parse(r))
      .then(setTask)
      .catch(() => {
        setErr(`Could not find a task at ${src}. Please check the src.`);
      });
  }, [src]);

  if (err) {
    return <pre className="element-bitflow">{err}</pre>;
  }

  return (
    <div className="element-bitflow" style={{ height }}>
      <Suspense fallback={<Loading />}>
        {task ? <Task task={task} /> : <Loading />}
      </Suspense>
    </div>
  );
};

type ElementBitflowState = {};

const initialState: ElementBitflowState = {};

const sliceBitflow = createSlice({
  name: "element.bitflow",
  initialState,
  reducers: {},
});

export default {
  directives: { flow: DirectiveFlow, task: DirectiveTask },
  slice: sliceBitflow,
};
