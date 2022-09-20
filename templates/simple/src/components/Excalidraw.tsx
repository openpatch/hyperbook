import { NonDeletedExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawProps as EDP,
} from "@excalidraw/excalidraw/types/types";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getHyperbookUrl } from "../utils/hyperbook";
import { usePrefersColorScheme } from "../utils/usePreferesColorScheme";

type ExcalidrawProps = {
  file: string;
  height: number;
};

export const Excalidraw = ({ file, height }: ExcalidrawProps) => {
  const router = useRouter();
  const [preview, setPreview] = useState(process.env.NODE_ENV == "development");
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

  const loadData = async () => {
    const url = getHyperbookUrl(file);
    return fetch(url)
      .then((res) => res.json())
      .then((json) => ({
        ...json,
        appState: {
          ...json?.appState,
          collaborators: [],
          theme: preferedColorScheme,
        },
      }))
      .catch(() => {
        return {
          appState: {
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
        className={preview ? "edit" : "view"}
        style={{
          width: "100%",
          position: "relative",
          height,
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
