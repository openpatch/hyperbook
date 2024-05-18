import { Shell } from "@hyperbook/shell";
import { ChangeBookFileMessage } from "../src/messages/messageTypes";
import React from "react";
import { Markdown } from "@hyperbook/markdown";
import { useLink } from "@hyperbook/provider";

type PageProps = ChangeBookFileMessage["payload"];

export const Page = ({ markdown, data, navigation }: PageProps) => {
  const Link = useLink();
  return (
    <Shell navigation={navigation}>
      <article>
        <Markdown children={markdown} showToc={data.toc !== false} />
      </article>
      {!data.hide && (
        <div className="jump-container">
          {navigation.previous ? (
            <Link className="jump previous" href={navigation.previous.href}>
              {navigation.previous.name}
            </Link>
          ) : (
            <div className="flex" />
          )}
          {navigation.next ? (
            <Link className="jump next" href={navigation.next.href}>
              {navigation.next.name}
            </Link>
          ) : (
            <div className="flex" />
          )}
        </div>
      )}
    </Shell>
  );
};
