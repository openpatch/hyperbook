import { PatchesProvider } from "@openpatch/patches";
import { BitflowProvider, useBit, useBitTask } from "@bitflow/provider";
import { Flow as IFlow, FlowTaskNode } from "@bitflow/core";
import { bits } from "@bitflow/bits";
import { DoLocal } from "@bitflow/do-local";
import { FC, useState } from "react";
import { getHyperbook } from "../utils/hyperbook";
import { TaskShell, TaskShellProps } from "@bitflow/shell";

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
        bits={bits}
      >
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
      </BitflowProvider>
    </PatchesProvider>
  );
};

export const Task: FC<{ task: FlowTaskNode["data"] }> = ({ task }) => {
  const bit = bits.task[task.subtype];
  const [result, setResult] = useState<Bitflow.TaskResult>();
  const [key, setKey] = useState<Date>(new Date());

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
    <PatchesProvider standalone={false}>
      <BitflowProvider
        locale={hyperbook.language || "en"}
        config={{}}
        bits={bits}
      >
        <TaskShell
          key={key.toString()}
          task={task}
          mode={result ? "result" : "default"}
          evaluate={evaluate}
          result={result}
          onRetry={retry}
          TaskComponent={bit.Task}
        />
      </BitflowProvider>
    </PatchesProvider>
  );
};
