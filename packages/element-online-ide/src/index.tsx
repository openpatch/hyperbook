import { FC, ReactNode } from "react";
import hash from "object-hash";
import "./index.css";
import { useConfig } from "@hyperbook/provider";

type DirectiveOnlineIdeProps = {
  children?: ReactNode;
  node: any;
  url?: string;
  id: string;
  fileList?: boolean;
  console?: boolean;
  pCode?: boolean;
  errorList?: boolean;
  bottomPanel?: boolean;
  speed?: number;
  height?: string | number;
};

const nodeToText = (n: any): string => {
  return n.children
    ?.map((n: any) => (n.value ? n.value : nodeToText(n)))
    .join(" ");
};

const DirectiveOnlineIde: FC<DirectiveOnlineIdeProps> = ({
  node,
  url = "https://onlineide.openpatch.org",
  height = "600px",
  fileList = true,
  console: con = true,
  pCode = false,
  bottomPanel = true,
  errorList = true,
  speed = 1000,
  id,
}) => {
  if (!id) {
    id = hash(node);
  }
  const config = useConfig();
  const ideConfig = config?.elements?.onlineide;

  if (ideConfig?.url) {
    url = ideConfig.url;
  }

  if (ideConfig?.height) {
    height = ideConfig.height;
  }

  const codes: { title: string; code: string; hint?: boolean }[] = node.children
    ?.filter((n: any) => n.tagName === "pre")
    .flatMap((n: any) => {
      return n.children
        ?.filter((n: any) => n.tagName === "code")
        .map((n: any) => {
          return {
            title: n.data.meta || "",
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
  let html = `{'id': '${id}', 'speed': ${speed}, 'withBottomPanel': ${bottomPanel},'withPCode': ${pCode},'withConsole': ${con},'withFileList': ${fileList},'withErrorList': ${errorList}}`;
  html = html + "\n" + scripts.join("\n");

  return (
    <div className="online-ide">
      <iframe
        srcDoc={`<script>window.jo_doc = window.frameElement.textContent;</script><script src='${url}/js/includeide/includeIDE.js'></script>`}
        height={height}
        frameBorder="0"
        dangerouslySetInnerHTML={{
          __html: html,
        }}
      ></iframe>
    </div>
  );
};

export default {
  directives: {
    onlineide: DirectiveOnlineIde,
  },
};
