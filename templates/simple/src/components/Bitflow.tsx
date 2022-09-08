import { PatchesProvider } from "@openpatch/patches";
import { BitflowProvider, useFlow } from "@bitflow/provider";
import { Flow as IFlow, FlowTaskNode } from "@bitflow/core";
import { bits } from "@bitflow/bits";
import { DoLocal } from "@bitflow/do-local";
import { FC, useState } from "react";
import { getHyperbook } from "../utils/hyperbook";
import { TaskShell } from "@bitflow/shell";
import { ZodError } from "zod";

const hyperbook = getHyperbook();

const getUrl = (src: string) => {
  const { basePath } = hyperbook;
  if (
    process.env.NODE_ENV !== "production" &&
    basePath &&
    src.startsWith("/")
  ) {
    if (basePath.endsWith("/")) {
      src = basePath.slice(0, -1) + src;
    } else {
      src = basePath + src;
    }
  }

  return src;
};

export const Flow: FC<{ flow: IFlow }> = ({ flow }) => {
  return (
    <PatchesProvider standalone={false}>
      <BitflowProvider
        locale={hyperbook.language || "en"}
        config={{}}
        //@ts-ignore
        bits={bits}
      >
        <FlowInner flow={flow} />
      </BitflowProvider>
    </PatchesProvider>
  );
};

const FlowInner: FC<{ flow: IFlow }> = ({ flow }) => {
  const { FlowSchema } = useFlow();

  try {
    FlowSchema.parse(flow);
  } catch (e) {
    if (e instanceof ZodError) {
      return (
        <p>
          {e.issues
            .map((i) => i.code + ": " + i.path.join(".") + " " + i.message)
            .join("\n")}
        </p>
      );
    }
    return <p>Error</p>;
  }
  return (
    <DoLocal
      flow={flow}
      config={{
        soundUrls: {
          correct: getUrl("/correct.mp3"),
          wrong: getUrl("/wrong.mp3"),
          unknown: getUrl("/unknown.mp3"),
          manual: getUrl("/manual.mp3"),
        },
      }}
    />
  );
};

export const Task: FC<{ task: FlowTaskNode["data"] }> = ({ task }) => {
  return (
    <PatchesProvider standalone={false}>
      <BitflowProvider
        locale={hyperbook.language || "en"}
        config={{}}
        //@ts-ignore
        bits={bits}
      >
        <TaskInner task={task} />
      </BitflowProvider>
    </PatchesProvider>
  );
};

export const TaskInner: FC<{ task: FlowTaskNode["data"] }> = ({ task }) => {
  const bit = bits.task[task.subtype];
  const [result, setResult] = useState<Bitflow.TaskResult>();
  const [key, setKey] = useState<Date>(new Date());
  const { FlowNodeSchema } = useFlow();

  try {
    FlowNodeSchema.parse({
      id: "",
      position: {
        x: 0,
        y: 0,
      },
      type: "task",
      data: task,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      return (
        <p>
          {e.issues
            .map((i) => i.code + ": " + i.path.join(".") + " " + i.message)
            .join("\n")}
        </p>
      );
    }
    return <p>"Error"</p>;
  }

  const evaluate = async (answer: Bitflow.TaskAnswer) => {
    const result = await bit.evaluate({ answer, task });
    setResult(result);

    return result;
  };

  const retry = async () => {
    setResult(null);
    setKey(new Date());
  };

  return (
    <TaskShell
      key={key.toString()}
      task={task}
      mode={result ? "result" : "default"}
      evaluate={evaluate}
      result={result}
      onRetry={retry}
      soundUrls={{
        correct: getUrl("/correct.mp3"),
        wrong: getUrl("/wrong.mp3"),
        unknown: getUrl("/unknown.mp3"),
        manual: getUrl("/manual.mp3"),
      }}
      TaskComponent={bit.Task}
    />
  );
};
