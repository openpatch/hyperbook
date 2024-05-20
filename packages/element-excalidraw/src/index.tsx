import {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  ExcalidrawProps as EDP,
} from "@excalidraw/excalidraw/types/types";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import {
  useColorScheme,
  useConfig,
  useEnv,
  useFile,
  useMakeUrl,
  useRouter,
} from "@hyperbook/provider";
import "./index.css";

type DirectiveExcalidrawProps = {
  src: string;
  file: string;
  aspectRatio: string;
  autoZoom: string;
  edit: string;
};

const DirectiveExcalidraw: FC<DirectiveExcalidrawProps> = ({
  file,
  aspectRatio,
  autoZoom: autoZoomS,
  edit: editS,
  src,
}) => {
  if (src) {
    file = src;
  }
  const config = useConfig();
  const excalidrawConfig = config?.elements?.excalidraw;

  let autoZoom = excalidrawConfig?.autoZoom ?? true;
  let edit = excalidrawConfig?.edit ?? false;

  if (autoZoomS == "false") {
    autoZoom = false;
  } else if (autoZoomS == "true") {
    autoZoom = true;
  }

  if (editS == "false") {
    edit = false;
  } else if (editS == "true") {
    edit = true;
  }

  if (!aspectRatio) {
    aspectRatio = excalidrawConfig?.aspectRation ?? "16/9";
  }

  const env = useEnv();
  const [loadFile, saveFile] = useFile();
  const router = useRouter();
  const makeUrl = useMakeUrl();
  const [preview, setPreview] = useState(env == "development");
  const initialData = useRef<ExcalidrawInitialDataState>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<
    "default" | "saving" | "unsaved" | "saving-failed"
  >("default");
  const [Comp, setComp] = useState<FC<any>>();
  const [preferedColorScheme] = useColorScheme();
  let api = useRef<ExcalidrawImperativeAPI>();

  const togglePreview = () => {
    setPreview((p) => !p);
  };

  useEffect(() => {
    import("@excalidraw/excalidraw").then((comp) => {
      setComp(comp.Excalidraw);
    });
  }, []);

  const handleScroll = () => {
    if (api.current) {
      api.current.refresh();
    }
  };

  const debounce = (func: Function, timeout = 300) => {
    let timer: NodeJS.Timeout;
    return (...args: any) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        func.apply(this, args);
      }, timeout);
    };
  };

  const handleResize = () => {
    if (autoZoom) {
      api.current?.scrollToContent(undefined, {
        fitToViewport: true,
        viewportZoomFactor: 0.9,
      });
    }
  };

  useEffect(() => {
    const stopSpace = (e: KeyboardEvent) => {
      if (e.which === 32 && e.target === document.body) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", stopSpace);

    return () => {
      window.removeEventListener("keydown", stopSpace);
    };
  }, []);

  useEffect(() => {
    document
      .getElementsByTagName("main")?.[0]
      ?.addEventListener("scroll", handleScroll);

    return () => {
      document
        .getElementsByTagName("main")?.[0]
        ?.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const debounceResize = debounce(handleResize, 300);
    window.addEventListener("resize", debounceResize);

    return () => {
      window.removeEventListener("resize", debounceResize);
    };
  }, [autoZoom]);

  useEffect(() => {
    if (api.current) {
      api.current.updateScene({
        appState: { theme: preferedColorScheme },
      });
    }
  }, [preferedColorScheme]);

  useEffect(() => {
    if (autoZoom) {
      setTimeout(() => {
        api.current?.scrollToContent(undefined, {
          fitToViewport: true,
          viewportZoomFactor: 0.9,
        });
      }, 2000);
    }
  }, [api, autoZoom]);

  const loadData = async (): Promise<ExcalidrawInitialDataState> => {
    const url = makeUrl(file, "public");
    return loadFile(url)
      .then((text) => JSON.parse(text))
      .then((data) => {
        initialData.current = data;
        return {
          ...data,
          scrollToContent: autoZoom,
          appState: {
            ...data?.appState,
            collaborators: [],
            theme: preferedColorScheme,
          },
        };
      })
      .catch(() => {
        return {};
      });
  };

  const save = () => {
    if (api.current) {
      const elements = api.current.getSceneElements();
      const appState = api.current.getAppState();
      const files = api.current.getFiles();
      const data = {
        type: "excalidraw",
        version: 2,
        source: "https://hyperbook.openpatch.org",
        elements,
        appState,
        files,
      };

      setState("saving");

      saveFile(file, JSON.stringify(data), "public")
        .then(() => {
          setState("default");
        })
        .catch((e) => {
          console.log(e);
          setState("saving-failed");
        });
    }
  };

  const handleLinkOpen: EDP["onLinkOpen"] = useCallback(
    (element: any, event: any) => {
      const link = element.link;
      const { nativeEvent } = event.detail;
      const isNewTab = nativeEvent.ctrlKey || nativeEvent.metaKey;
      const isNewWindow = nativeEvent.shiftKey;
      const isInternalLink =
        link?.startsWith("/") || link?.includes(window.location.origin);
      if (isInternalLink && !isNewTab && !isNewWindow) {
        // signal that we're handling the redirect ourselves
        if (link) {
          event.preventDefault();
          router.push(link);
        }
      }
    },
    [],
  );

  return (
    <div className="element-excalidraw">
      <div
        ref={containerRef}
        className={[preview || edit ? "edit" : "view"].join(" ")}
        style={{
          width: "100%",
          position: "relative",
          marginBottom: 10,
          aspectRatio,
        }}
      >
        {Comp && (
          <Comp
            langCode={config.language}
            onLinkOpen={handleLinkOpen}
            ref={api}
            initialData={loadData()}
            viewModeEnabled={!preview && !edit}
          />
        )}
      </div>
      {env === "development" && (
        <div className="development">
          <div className="toolbar">
            <button className="save" onClick={() => save()}>
              {state === "default" && `Save to file ${file}`}
              {state === "saving" && `Saving`}
              {state === "saving-failed" && `Failed. Try again.`}
            </button>
            <button className="preview" onClick={() => togglePreview()}>
              Toggle Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default {
  directives: { excalidraw: DirectiveExcalidraw },
};
