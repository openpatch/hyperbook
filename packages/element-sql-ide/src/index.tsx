import { FC, ReactNode, useRef } from "react";
import hash from "object-hash";
import "./index.css";
import { useConfig, useMakeUrl } from "@hyperbook/provider";

type DirectiveSqlIdeProps = {
  children?: ReactNode;
  node: any;
  url?: string;
  id: string;
  db: string;
  height?: string | number;
};

const nodeToText = (n: any): string => {
  return n.children
    ?.map((n: any) => (n.value ? n.value : nodeToText(n)))
    .join(" ");
};

const DirectiveSqlIde: FC<DirectiveSqlIdeProps> = ({
  node,
  url = "https://sqlide.openpatch.org",
  height = "600px",
  db = "https://sqlide.openpatch.org/assets/databases/world1.sqLite",
  id,
}) => {
  if (!id) {
    id = hash(node);
  }

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const makeUrl = useMakeUrl();
  const config = useConfig();
  const ideConfig = config?.elements?.sqlide;

  if (ideConfig?.url) {
    url = ideConfig.url;
  }

  if (ideConfig?.height) {
    height = ideConfig.height;
  }

  if (ideConfig?.db) {
    db = makeUrl(ideConfig.db, "public");
  }

  const openInFullscreen = () => {
    if (iframeRef.current?.requestFullscreen) {
      iframeRef.current.requestFullscreen();
    }
  };

  const codes: { title: string; code: string; hint?: boolean }[] = node.children
    ?.filter((n: any) => n.tagName === "pre")
    .flatMap((n: any) => {
      return n.children
        ?.filter((n: any) => n.tagName === "code")
        .map((n: any) => {
          return {
            title: n.data?.meta || "",
            code: nodeToText(n) || "",
            hint: n?.properties?.className?.[1] === "language-markdown",
          };
        });
    });

  const scripts = codes.map((c) => {
    return `<script type="plain/text" title="${c.title}" ${
      c.hint ? `data-type="hint"` : ""
    }>
        ${c.code}
        </script>`;
  });
  let html = `{'id': '${id}', 'databaseURL': '${db}'}`;
  html = html + "\n" + scripts.join("\n");
  html =
    html +
    "\n" +
    `<style>
.joe_javaOnlineDiv {
  box-shadow: none;
  margin: 0!important;
  top: 0!important;
  width: 100%!important;
  height: calc(100% - 5px) !important;
  border: none !important;
}
</style>`;

  return (
    <div className="sql-ide">
      <iframe
        ref={iframeRef}
        srcDoc={`<script>window.jo_doc = window.frameElement.textContent;</script><script src='${url}/js/includeide/includeIDE.js'></script>`}
        height={height}
        frameBorder="0"
        dangerouslySetInnerHTML={{
          __html: html,
        }}
      ></iframe>
      <div className="menu">
        <button onClick={openInFullscreen}>Fullscreen</button>
      </div>
    </div>
  );
};

export default {
  directives: {
    sqlide: DirectiveSqlIde,
  },
};
