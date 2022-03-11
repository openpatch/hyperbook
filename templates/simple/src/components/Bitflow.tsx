import { PatchesProvider } from "@openpatch/patches";
import { BitflowProvider } from "@bitflow/provider";
import { Flow as IFlow } from "@bitflow/core";
import { bits } from "@bitflow/bits";
import { DoLocal } from "@bitflow/do-local";
import { FC } from "react";
import { getHyperbook } from "../utils/hyperbook";

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
      <BitflowProvider config={{}} bits={bits}>
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
