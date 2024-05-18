import React, { Fragment } from "react";
import { Shell } from "@hyperbook/shell";
import { ErrorBoundary } from "./ErrorBoundary";
import { Markdown } from "@hyperbook/markdown";
import { ChangeGlossaryFileMessage } from "../src/messages/messageTypes";
import { useLink } from "@hyperbook/provider";

type TermProps = ChangeGlossaryFileMessage["payload"];

export const Term = ({ navigation, data, markdown, references }: TermProps) => {
  const Link = useLink();
  return (
    <Shell navigation={navigation}>
      <article>
        <Markdown children={markdown} showToc={data.toc !== false} />
        <div className="pages">
          {references.map((p, i) => (
            <Fragment key={p.path.href}>
              {i > 0 && ", "}
              <Link href={p.path.href || ""}>
                {p.markdown?.data?.name ?? p.name}
              </Link>
            </Fragment>
          ))}
        </div>
      </article>
    </Shell>
  );
};
