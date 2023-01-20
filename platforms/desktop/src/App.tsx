import { useEffect, useState } from "react";
import { Provider, ProviderProps } from "@hyperbook/provider";
import elementTab from "@hyperbook/element-tabs";
import elementAlert from "@hyperbook/element-alert";
import elementBitflow from "@hyperbook/element-bitflow";
import elementTerm from "@hyperbook/element-term";
import elementYoutube from "@hyperbook/element-youtube";
import elementProtect from "@hyperbook/element-protect";
import elementCollapsible from "@hyperbook/element-collapsible";
import elementScratchblock from "@hyperbook/element-scratchblock";
import elementDl from "@hyperbook/element-dl";
import elementBookmarks from "@hyperbook/element-bookmarks";
import elementStruktog from "@hyperbook/element-struktog";
import elementQr from "@hyperbook/element-qr";
import elementMermaid from "@hyperbook/element-mermaid";
import elementExcalidraw from "@hyperbook/element-excalidraw";
import { Markdown } from "@hyperbook/markdown";
import { Styles } from "@hyperbook/styles";
import { FileChangedEvent, ConfigChangeEvent, OpenFileEvent } from "./events";
import { ErrorBoundary } from "./ErrorBoundary";
import { Shell } from "@hyperbook/shell";
import { ipcRenderer } from "electron";
import createElectronStorage from "redux-persist-electron-storage";
import ElectronStore from "electron-store";

const electronStore = new ElectronStore();

export const App = () => {
  const [state, setState] = useState<FileChangedEvent>();
  const [config, setConfig] = useState<ConfigChangeEvent>();
  const assetPath = state?.assetsPath;

  useEffect(() => {
    ipcRenderer.on("FILE_CHANGED", (_, arg: FileChangedEvent) => {
      setState(arg);
    });
    ipcRenderer.on("CONFIG_CHANGE", (_, arg: ConfigChangeEvent) => {
      setConfig(arg);
    });

    ipcRenderer.send("READY");
  }, []);

  if (!state) {
    return "...";
  }

  return (
    <ErrorBoundary message="You have encountered an error.">
      <Provider
        config={config}
        Link={({ href, ...props }) => {
          href = href?.split("#")[0];
          if (href?.startsWith("file:///")) {
            return (
              <a
                href="#"
                title={href}
                onClick={() => {
                  ipcRenderer.send("OPEN_FILE", {
                    path: href as string,
                    rootFolder: "",
                    basePath: "",
                  } as OpenFileEvent);
                }}
                {...props}
              />
            );
          } else if (href?.startsWith("/")) {
            let rootFolder = "";
            if (!href.startsWith("/glossary")) {
              rootFolder = "book";
            }
            return (
              <a
                href="#"
                title={href}
                onClick={() => {
                  ipcRenderer.send("OPEN_FILE", {
                    path: href as string,
                    rootFolder: rootFolder,
                    basePath: config?.basePath,
                  } as OpenFileEvent);
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
        storage={createElectronStorage({ electronStore })}
        makeUrl={() => (p, rootFolder) => {
          if (p?.startsWith("/")) {
            if (rootFolder) {
              return assetPath + rootFolder + p;
            } else {
              return assetPath + p;
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
          elementScratchblock,
          elementExcalidraw,
        ]}
        loadFile={() => async (path) => {
          return fetch(path).then((res) => res.text());
        }}
        saveFile={() => async (path, content, rootFolder) => {
          ipcRenderer.send("WRITE", {
            type: "WRITE",
            payload: {
              content,
              path,
              rootFolder,
              basePath: config?.basePath,
            },
          });
        }}
        getActivePageId={async () => state?.navigation?.current?.href || ""}
      >
        <Styles />
        <Shell navigation={state?.navigation} toc={state?.toc}>
          <ErrorBoundary message="You have a syntax error in your markdown file.">
            <Markdown children={state?.content || ""} />
          </ErrorBoundary>
        </Shell>
      </Provider>
    </ErrorBoundary>
  );
};
