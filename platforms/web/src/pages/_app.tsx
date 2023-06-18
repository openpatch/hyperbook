import "../index.css";
import "@hyperbook/shell/index.css";
import "@hyperbook/markdown/katex.css";
import "@hyperbook/markdown/index.css";
import { Provider, ProviderProps } from "@hyperbook/provider";
import elementTab from "@hyperbook/element-tabs";
import "@hyperbook/element-tabs/index.css";
import elementAlert from "@hyperbook/element-alert";
import "@hyperbook/element-alert/index.css";
import elementTerm from "@hyperbook/element-term";
import "@hyperbook/element-term/index.css";
import elementYoutube from "@hyperbook/element-youtube";
import "@hyperbook/element-youtube/index.css";
import elementPlantuml from "@hyperbook/element-plantuml";
import "@hyperbook/element-plantuml/index.css";
import elementProtect from "@hyperbook/element-protect";
import "@hyperbook/element-protect/index.css";
import elementCollapsible from "@hyperbook/element-collapsible";
import "@hyperbook/element-collapsible/index.css";
import elementDl from "@hyperbook/element-dl";
import "@hyperbook/element-dl/index.css";
import elementBookmarks from "@hyperbook/element-bookmarks";
import "@hyperbook/element-bookmarks/index.css";
import elementStruktog from "@hyperbook/element-struktog";
import "@hyperbook/element-struktog/index.css";
import elementQr from "@hyperbook/element-qr";
import "@hyperbook/element-qr/index.css";
import elementMermaid from "@hyperbook/element-mermaid";
import "@hyperbook/element-mermaid/index.css";
import elementExcalidraw from "@hyperbook/element-excalidraw";
import "@hyperbook/element-excalidraw/index.css";
import elementEmbed from "@hyperbook/element-embed";
import "@hyperbook/element-embed/index.css";
import elementOnlineIde from "@hyperbook/element-online-ide";
import "@hyperbook/element-online-ide/index.css";
import elementSqlIde from "@hyperbook/element-sql-ide";
import "@hyperbook/element-sql-ide/index.css";
import elementBitflow from "@hyperbook/element-bitflow";
import "@hyperbook/element-bitflow/index.css";
import elementScratchblock from "@hyperbook/element-scratchblock";
import "@hyperbook/element-scratchblock/index.css";
import Link from "next/link";
import Head from "next/head";
import { Styles } from "@hyperbook/styles";
import { localStorage } from "@hyperbook/store";
import { useRouter } from "next/router";
import { useEffect } from "react";

import hb from "../../hyperbook.json";

const MyLink: ProviderProps["Link"] = ({ ref, href, children, ...props }) => {
  return (
    <Link href={href} {...props}>
      {children}
    </Link>
  );
};

const makeUrl: ProviderProps["makeUrl"] =
  ({ basePath }) =>
  (path) => {
    if (
      process.env.NODE_ENV === "production" &&
      basePath &&
      path.startsWith("/")
    ) {
      if (basePath.endsWith("/")) {
        path = basePath.slice(0, -1) + path;
      } else {
        path = basePath + path;
      }
    }
    return path;
  };

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    document.documentElement.lang = pageProps.locale;
  }, [pageProps.locale]);

  return (
    <Provider
      Link={MyLink}
      Head={Head}
      config={hb as any}
      makeUrl={makeUrl}
      env={process.env.NODE_ENV === "production" ? "production" : "development"}
      elements={[
        elementTab,
        elementAlert,
        elementTerm,
        elementYoutube,
        elementCollapsible,
        elementPlantuml,
        elementProtect,
        elementDl,
        elementEmbed,
        elementBookmarks,
        elementStruktog,
        elementOnlineIde,
        elementSqlIde,
        elementQr,
        elementMermaid,
        elementExcalidraw,
        elementScratchblock,
        elementBitflow,
      ]}
      router={router}
      storage={localStorage}
      loadFile={() => async (path) => {
        return fetch(path).then((res) => res.text());
      }}
      saveFile={() => async (path, content, rootFolder) => {
        await fetch("/api/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            path,
            content,
            rootFolder,
          }),
        });
      }}
      getActivePageId={async () => router.asPath.split("#")?.[0] || "/"}
    >
      <Styles />
      <Component {...pageProps} />
    </Provider>
  );
}
