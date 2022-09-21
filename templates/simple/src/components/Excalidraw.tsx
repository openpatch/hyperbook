import {
  ExcalidrawImperativeAPI,
  ExcalidrawProps as EDP,
} from "@excalidraw/excalidraw/types/types";
import { useRouter } from "next/router";
import {
  useCallback,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
} from "react";
import { getHyperbookUrl } from "../utils/hyperbook";
import { usePrefersColorScheme } from "../utils/usePreferesColorScheme";

type ExcalidrawProps = {
  file: string;
  aspectRatio: string;
  autoZoom: boolean;
};

export const Excalidraw = ({
  file,
  aspectRatio,
  autoZoom = true,
}: ExcalidrawProps) => {
  const router = useRouter();
  const [preview, setPreview] = useState(process.env.NODE_ENV == "development");
  const initialData = useRef<EDP["initialData"]>();
  const containerRef = useRef<HTMLDivElement>();
  const [state, setState] = useState<
    "default" | "saving" | "unsaved" | "saving-failed"
  >("default");
  const [Comp, setComp] = useState(null);
  const preferedColorScheme = usePrefersColorScheme();
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

  useLayoutEffect(() => {
    const handleResize = () => {
      if (containerRef.current && autoZoom == true) {
        const currentWidth = containerRef.current.clientWidth;
        const initialWidth = initialData.current?.appState?.width || 0;

        if (initialWidth > 0) {
          const widthRatio = currentWidth / initialWidth;
          const initialZoom = initialData.current?.appState?.zoom?.value || 1;

          api.current.updateScene({
            appState: {
              ...api.current.getAppState(),
              zoom: {
                value: (initialZoom * widthRatio) as any,
              },
            },
          });
        }
      }
    };

    window.addEventListener("resize", handleResize);

    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [autoZoom]);

  useEffect(() => {
    document
      .getElementsByTagName("main")[0]
      .addEventListener("scroll", handleScroll);

    return () => {
      document
        .getElementsByTagName("main")[0]
        .removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (api.current) {
      api.current.updateScene({
        appState: { theme: preferedColorScheme },
      });
    }
  }, [preferedColorScheme]);

  const loadData = async () => {
    const url = getHyperbookUrl(file);
    return fetch(url)
      .then((res) => res.json())
      .catch(() => {
        return {};
      })
      .then((data) => {
        initialData.current = data;
        return {
          ...data,
          appState: {
            ...data?.appState,
            collaborators: [],
            theme: preferedColorScheme,
          },
        };
      });
  };

  const save = () => {
    const elements = api.current.getSceneElements();
    const appState = api.current.getAppState();
    const files = api.current.getFiles();
    const data = { elements, appState, files };

    setState("saving");

    fetch("/api/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: file,
        isPublic: true,
        content: data,
      }),
    })
      .then(() => {
        setState("default");
      })
      .catch(() => {
        setState("saving-failed");
      });
  };

  const handleLinkOpen: EDP["onLinkOpen"] = useCallback((element, event) => {
    const link = element.link;
    const { nativeEvent } = event.detail;
    const isNewTab = nativeEvent.ctrlKey || nativeEvent.metaKey;
    const isNewWindow = nativeEvent.shiftKey;
    const isInternalLink =
      link.startsWith("/") || link.includes(window.location.origin);
    if (isInternalLink && !isNewTab && !isNewWindow) {
      // signal that we're handling the redirect ourselves
      event.preventDefault();
      router.push(link);
    }
  }, []);

  return (
    <div>
      <div
        ref={containerRef}
        className={preview ? "edit" : "view"}
        style={{
          width: "100%",
          position: "relative",
          aspectRatio,
        }}
      >
        {Comp && (
          <Comp
            onLinkOpen={handleLinkOpen}
            ref={api}
            initialData={loadData()}
            viewModeEnabled={!preview}
          />
        )}
      </div>
      {process.env.NODE_ENV === "development" && (
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
function useLayouEffect(arg0: () => () => void, arg1: undefined[]) {
  throw new Error("Function not implemented.");
}
