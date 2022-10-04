import { PatchesProvider } from "@openpatch/patches";
import { BitflowProvider, useFlow } from "@bitflow/provider";
import { FlowTaskNode } from "@bitflow/core";
import { bits } from "@bitflow/bits";
import { FC, useState } from "react";
import { TaskShell } from "@bitflow/shell";
import { ZodError } from "zod";
import { useConfig, useMakeUrl } from "@hyperbook/provider";

const Task: FC<{ task: FlowTaskNode["data"] }> = ({ task }) => {
  const { language } = useConfig();
  return (
    <PatchesProvider standalone={false}>
      <BitflowProvider locale={language || "en"} config={{}} bits={bits}>
        <TaskInner task={task} />
      </BitflowProvider>
    </PatchesProvider>
  );
};

export const TaskInner: FC<{ task: FlowTaskNode["data"] }> = ({ task }) => {
  const makeUrl = useMakeUrl();
  const bit = bits.task[task.subtype];
  const [result, setResult] = useState<any>();
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

  const evaluate = async (answer: any) => {
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
        correct: makeUrl("/correct.mp3", "public"),
        wrong: makeUrl("/wrong.mp3", "public"),
        unknown: makeUrl("/unknown.mp3", "public"),
        manual: makeUrl("/manual.mp3", "public"),
      }}
      TaskComponent={bit.Task}
    />
  );
};

export default Task;
