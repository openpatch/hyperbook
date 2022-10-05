import React, { useEffect, useState } from "react";
import { Provider, ProviderProps } from "@hyperbook/provider";
import elementTab from "@hyperbook/element-tabs";
import elementAlert from "@hyperbook/element-alert";
import elementBitflow from "@hyperbook/element-bitflow";
import elementTerm from "@hyperbook/element-term";
import elementYoutube from "@hyperbook/element-youtube";
import elementProtect from "@hyperbook/element-protect";
import elementCollapsible from "@hyperbook/element-collapsible";
import elementDl from "@hyperbook/element-dl";
import elementBookmarks from "@hyperbook/element-bookmarks";
import elementStruktog from "@hyperbook/element-struktog";
import elementQr from "@hyperbook/element-qr";
import elementMermaid from "@hyperbook/element-mermaid";
import elementExcalidraw from "@hyperbook/element-excalidraw";
import { Markdown } from "@hyperbook/markdown";
import { Styles } from "@hyperbook/styles";
import { ChangeMessage, Message } from "../src/messages/messageTypes";
import { ErrorBoundary } from "./ErrorBoundary";

const initialState = (window as any).initialState as ChangeMessage["payload"];
const initialConfig = (window as any).initialConfig as ProviderProps["config"];
const workspacePath = (window as any).workspacePath as string;
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
  const [state, setState] = useState<ChangeMessage["payload"]>(initialState);
  const [config, setConfig] = useState<ProviderProps["config"]>(initialConfig);

  useEffect(() => {
    window.addEventListener("message", (event: MessageEvent<Message>) => {
      if (event.data.type === "CHANGE") {
        setState(event.data.payload);
      } else if (event.data.type === "CONFIG_CHANGE") {
        setConfig(event.data.payload as any);
      }
    });
  }, []);

  return (
    <ErrorBoundary message="You probably have an invalid hyperbook.json file.">
      <Provider
        config={config}
        env="development"
        Link={({ href, ...props }) => {
          href = href?.split("#")[0];
          if (href?.startsWith("/")) {
            let rootFolder = "";
            if (!href.startsWith("/glossary")) {
              rootFolder = "book";
            }
            return (
              <a
                href="#"
                onClick={() => {
                  vscode.postMessage({
                    type: "OPEN",
                    payload: {
                      path: href as string,
                      rootFolder: rootFolder,
                    },
                  });
                }}
                {...props}
              />
            );
          }
          return <a href={href} {...props} />;
        }}
        storage={createNoopStorage()}
        makeUrl={(p, rootFolder) => {
          if (p?.startsWith("/")) {
            if (rootFolder) {
              return workspacePath + "/" + rootFolder + p;
            } else {
              return workspacePath + p;
            }
          } else {
            return p || "";
          }
        }}
        elements={[
          elementTab,
          elementAlert,
          elementBitflow,
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
        ]}
        loadFile={async (path) => {
          return fetch(path).then((res) => res.text());
        }}
        saveFile={async (path, content, rootFolder) => {
          return vscode.postMessage({
            type: "WRITE",
            payload: {
              content,
              path,
              rootFolder,
            },
          });
        }}
        getActivePageId={async () => initialState.source || ""}
      >
        <Styles />
        <ErrorBoundary message="You have a syntax error in your markdown file.">
          <Markdown children={state?.content || ""} />
        </ErrorBoundary>
      </Provider>
    </ErrorBoundary>
  );
};
