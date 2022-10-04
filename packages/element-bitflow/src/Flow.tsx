import { PatchesProvider } from "@openpatch/patches";
import { BitflowProvider, useFlow } from "@bitflow/provider";
import { Flow as IFlow } from "@bitflow/core";
import { bits } from "@bitflow/bits";
import { DoLocal } from "@bitflow/do-local";
import { FC } from "react";
import { useConfig, useMakeUrl } from "@hyperbook/provider";
import { ZodError } from "zod";

const Flow: FC<{ flow: IFlow }> = ({ flow }) => {
  const { language } = useConfig();
  return (
    <PatchesProvider standalone={false}>
      <BitflowProvider locale={language || "en"} config={{}} bits={bits}>
        <FlowInner flow={flow} />
      </BitflowProvider>
    </PatchesProvider>
  );
};

const FlowInner: FC<{ flow: IFlow }> = ({ flow }) => {
  const { FlowSchema } = useFlow();
  const makeUrl = useMakeUrl();

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
          correct: makeUrl("/correct.mp3", "public"),
          wrong: makeUrl("/wrong.mp3", "public"),
          unknown: makeUrl("/unknown.mp3", "public"),
          manual: makeUrl("/manual.mp3", "public"),
        },
      }}
    />
  );
};

export default Flow;
