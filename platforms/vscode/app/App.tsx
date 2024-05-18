import React, { useEffect, useState } from "react";
import { Provider, ProviderProps } from "@hyperbook/provider";
import elementTab from "@hyperbook/element-tabs";
import elementTiles from "@hyperbook/element-tiles";
import elementAudio from "@hyperbook/element-audio";
import elementVideo from "@hyperbook/element-video";
import elementAlert from "@hyperbook/element-alert";
import elementBitflow from "@hyperbook/element-bitflow";
import elementTerm from "@hyperbook/element-term";
import elementYoutube from "@hyperbook/element-youtube";
import elementPlantuml from "@hyperbook/element-plantuml";
import elementProtect from "@hyperbook/element-protect";
import elementCollapsible from "@hyperbook/element-collapsible";
import elementScratchblock from "@hyperbook/element-scratchblock";
import elementDl from "@hyperbook/element-dl";
import elementBookmarks from "@hyperbook/element-bookmarks";
import elementStruktog from "@hyperbook/element-struktog";
import elementQr from "@hyperbook/element-qr";
import elementMermaid from "@hyperbook/element-mermaid";
import elementEmbed from "@hyperbook/element-embed";
import elementExcalidraw from "@hyperbook/element-excalidraw";
import elementOnlineIde from "@hyperbook/element-online-ide";
import elementSqlIde from "@hyperbook/element-sql-ide";
import elementSlideshow from "@hyperbook/element-slideshow";
import { Markdown } from "@hyperbook/markdown";
import { Styles } from "@hyperbook/styles";
import {
  ChangeBookFileMessage,
  ChangeGlossaryFileMessage,
  Message,
} from "../src/messages/messageTypes";
import { ErrorBoundary } from "./ErrorBoundary";
import { Shell } from "@hyperbook/shell";
import { Page } from "./Page";
import { Term } from "./Term";

const vscode = (window as any).vscode as VSCode;

const createNoopStorage = () => {
  return {
    getItem(_key: any) {
      return Promise.resolve(null);
    },
    setItem(_key: any, value: any) {
      return Promise.resolve(value);
    },
    removeItem(_key: any) {
      return Promise.resolve();
    },
  };
};

export const App = () => {
  const [state, setState] = useState<
    ChangeBookFileMessage | ChangeGlossaryFileMessage
  >();
  const [config, setConfig] = useState<ProviderProps["config"]>();
  const assetsPath = state?.payload.assetsPath ?? "";

  useEffect(() => {
    window.addEventListener("message", (event: MessageEvent<Message>) => {
      if (
        event.data.type === "CHANGE_BOOK_FILE" ||
        event.data.type === "CHANGE_GLOSSARY_FILE"
      ) {
        setState(event.data);
      } else if (event.data.type === "CONFIG_CHANGE") {
        setConfig(event.data.payload);
      }
    });

    vscode.postMessage({
      type: "READY",
    });
  }, []);

  if (!state) {
    return <div>...Loading</div>;
  }

  return (
    <ErrorBoundary message="You have encountered an error.">
      <Provider
        config={config}
        env="development"
        Link={({ href, ...props }) => {
          href = href?.split("#")[0];
          if (href?.startsWith("file:///")) {
            return (
              <a
                href="#"
                title={href}
                onClick={() => {
                  vscode.postMessage({
                    type: "OPEN",
                    payload: {
                      path: href as string,
                      rootFolder: "",
                      basePath: "",
                    },
                  });
                }}
                {...props}
              />
            );
          } else if (href?.startsWith("/")) {
            let rootFolder = "";
            if (href.startsWith("/glossary")) {
              rootFolder = "glossary";
            } else {
              rootFolder = "book";
            }
            return (
              <a
                href="#"
                title={href}
                onClick={() => {
                  vscode.postMessage({
                    type: "OPEN",
                    payload: {
                      path: href as string,
                      rootFolder: rootFolder,
                      basePath: config?.basePath,
                    },
                  });
                }}
                {...props}
              />
            );
          }
          return <a href={href} {...props} />;
        }}
        router={{
          push: async () => true,
        }}
        storage={createNoopStorage()}
        makeUrl={() => (p, rootFolder) => {
          if (p?.startsWith("/")) {
            if (rootFolder) {
              return assetsPath + "/" + rootFolder + p;
            } else {
              return assetsPath + p;
            }
          } else {
            return p || "";
          }
        }}
        elements={[
          elementTab,
          elementAudio,
          elementVideo,
          elementAlert,
          elementBitflow,
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
          elementScratchblock,
          elementExcalidraw,
          elementTiles,
          elementSlideshow,
        ]}
        loadFile={() => async (path) => {
          return fetch(path).then((res) => res.text());
        }}
        saveFile={() => async (path, content, rootFolder) => {
          return vscode.postMessage({
            type: "WRITE",
            payload: {
              content,
              path,
              rootFolder,
              basePath: config?.basePath,
            },
          });
        }}
        getActivePageId={async () =>
          state?.payload.navigation?.current?.href || ""
        }
      >
        <Styles />
        <ErrorBoundary message="You have a syntax error in your markdown file.">
          {state.type === "CHANGE_BOOK_FILE" && <Page {...state.payload} />}
          {state.type === "CHANGE_GLOSSARY_FILE" && <Term {...state.payload} />}
        </ErrorBoundary>
      </Provider>
    </ErrorBoundary>
  );
};
