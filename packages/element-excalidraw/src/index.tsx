import {
  ExcalidrawImperativeAPI,
  ExcalidrawProps as EDP,
} from "@excalidraw/excalidraw/types/types";
import {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  autoZoom: boolean;
  center: boolean;
  edit: boolean;
};

const DirectiveExcalidraw: FC<DirectiveExcalidrawProps> = ({
  file,
  aspectRatio,
  autoZoom,
  center,
  edit,
  src,
}) => {
  if (src) {
    file = src;
  }
  const config = useConfig();
  const excalidrawConfig = config?.elements?.excalidraw;

  if (!aspectRatio) {
    aspectRatio = excalidrawConfig?.aspectRation ?? "16/9";
  }

  if (!autoZoom) {
    autoZoom = excalidrawConfig?.autoZoom ?? true;
  }

  if (!center) {
    center = excalidrawConfig?.center ?? true;
  }

  if (!edit) {
    edit = excalidrawConfig?.edit ?? false;
  }

  const env = useEnv();
  const [loadFile, saveFile] = useFile();
  const router = useRouter();
  const makeUrl = useMakeUrl();
  const [preview, setPreview] = useState(env == "development");
  const initialData = useRef<EDP["initialData"]>();
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
      setComp(comp.Excalidraw as any);
    });
  }, []);

  const handleScroll = () => {
    if (api.current) {
      api.current.refresh();
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

  const getZoom = () => {
    const initialZoom = initialData.current?.appState?.zoom?.value || 1;
    if (containerRef.current && autoZoom == true) {
      const currentWidth = containerRef.current.clientWidth;
      const initialWidth = initialData.current?.appState?.width || 0;

      if (initialWidth > 0) {
        const widthRatio = currentWidth / initialWidth;

        return initialZoom * widthRatio;
      }
    }
    return initialZoom;
  };

  const handleResize = useCallback(() => {
    if (api.current) {
      api.current.updateScene({
        appState: {
          zoom: {
            value: getZoom(),
          },
        },
      });
    }
  }, []);

  useLayoutEffect(() => {
    window?.addEventListener("resize", handleResize);

    return () => {
      window?.removeEventListener("resize", handleResize);
    };
  }, []);

  useLayoutEffect(() => {
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
    if (api.current) {
      api.current.updateScene({
        appState: { theme: preferedColorScheme },
      });
    }
  }, [preferedColorScheme]);

  const loadData: EDP["initialData"] = async () => {
    const url = makeUrl(file, "public");
    return loadFile(url)
      .then((text) => JSON.parse(text))
      .then((data) => {
        initialData.current = data;
        const zoom = getZoom();
        return {
          ...data,
          scrollToContent: center,
          appState: {
            ...data?.appState,
            collaborators: [],
            theme: preferedColorScheme,
            zoom: {
              value: zoom,
            },
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
    []
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
