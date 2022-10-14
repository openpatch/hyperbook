import "../reset.css";
import "../styles.css";
import "../colors.css";
import "../szh-menu.css";
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
import elementBitflow from "@hyperbook/element-bitflow";
import "@hyperbook/element-bitflow/index.css";
import Link from "next/link";
import { Styles } from "@hyperbook/styles";
import { localStorage } from "@hyperbook/store";
import { useRouter } from "next/router";
import { getHyperbook, getHyperbookUrl } from "../utils/hyperbook";
import { useEffect } from "react";

const hb = getHyperbook();

const MyLink: ProviderProps["Link"] = ({ href, children, ...props }) => {
  return (
    <Link href={href}>
      <a {...props}>{children}</a>
    </Link>
  );
};

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    document.documentElement.lang = pageProps.locale;
  }, [pageProps.locale]);

  return (
    <Provider
      Link={MyLink}
      config={hb}
      makeUrl={getHyperbookUrl}
      env={process.env.NODE_ENV === "production" ? "production" : "development"}
      elements={[
        elementTab,
        elementAlert,
        elementTerm,
        elementYoutube,
        elementCollapsible,
        elementProtect,
        elementDl,
        elementBookmarks,
        elementStruktog,
        elementQr,
        elementMermaid,
        elementExcalidraw,
        elementBitflow,
      ]}
      storage={localStorage}
      loadFile={async (path) => {
        return fetch(path).then((res) => res.text());
      }}
      saveFile={async (path, content, rootFolder) => {
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
