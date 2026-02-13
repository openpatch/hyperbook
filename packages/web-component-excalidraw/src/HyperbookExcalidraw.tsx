import { Excalidraw, CaptureUpdateAction } from "@excalidraw/excalidraw";
import { FC, useCallback, useEffect, useState } from "react";
import {
  ExcalidrawImperativeAPI,
  type ExcalidrawProps as EDP,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/dist/types/excalidraw/types";

type HyperbookExcalidrawProps = {
  id: string;
  lang: string;
  autoZoom: boolean;
  edit: boolean;
  src: string;
  onlinkopen: (link: string) => void;
};

export const HyperbookExcalidraw: FC<HyperbookExcalidrawProps> = ({
  id,
  lang = "en",
  autoZoom = true,
  edit = false,
  src,
  onlinkopen = () => {},
}) => {
  const [api, setApi] = useState<ExcalidrawImperativeAPI>();

  if (!id) id = src;

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
      api?.scrollToContent(undefined, {
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
    const debounceResize = debounce(handleResize, 300);
    window.addEventListener("resize", debounceResize);

    return () => {
      window.removeEventListener("resize", debounceResize);
    };
  }, [api, autoZoom]);

  const darkModeToggle = document.querySelector("dark-mode-toggle") as any;

  const updateTheme = () => {
    api?.updateScene({
      appState: { theme: darkModeToggle.mode },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  };

  useEffect(() => {
    document.addEventListener("colorschemechange", updateTheme);

    return () => {
      document.removeEventListener("colorschemechange", updateTheme);
    };
  }, [api]);

  useEffect(() => {
    if (autoZoom) {
      setTimeout(() => {
        api?.scrollToContent(undefined, {
          fitToViewport: true,
          viewportZoomFactor: 0.9,
        });
      }, 2000);
    }
  }, [api, autoZoom]);

  const handleLinkOpen: EDP["onLinkOpen"] = useCallback(
    (element: any, event: any) => {
      const link = element.link;
      const { nativeEvent } = event.detail;
      const isNewTab = nativeEvent.ctrlKey || nativeEvent.metaKey;
      const isNewWindow = nativeEvent.shiftKey;
      if (!isNewTab && !isNewWindow) {
        // signal that we're handling the redirect ourselves
        if (link) {
          event.preventDefault();
          onlinkopen(link);
        }
      }
    },
    []
  );

  const loadData = async (): Promise<ExcalidrawInitialDataState> => {
    if (edit && id) {
      const store = (window as any).hyperbook.store;
      const result = await store.excalidraw.get(id);
      if (result) {
        return {
          ...result,
          scrollToContent: autoZoom,
          appState: {
            ...result?.appState,
            collaborators: [],
            theme: darkModeToggle.mode,
          },
        };
      }
    }

    return fetch(src)
      .then((res) => res.json())
      .then((data) => ({
        ...data,
        scrollToContent: autoZoom,
        appState: {
          ...data?.appState,
          collaborators: [],
          theme: darkModeToggle.mode,
        },
      }))
      .catch(() => ({}));
  };

  const handleChange: EDP["onChange"] = async (elements, state, files) => {
    if (edit && id) {
      const store = (window as any).hyperbook.store;
      store.excalidraw.put({ id, elements, state, files });
    }
  };

  return (
    <Excalidraw
      excalidrawAPI={(api) => setApi(api)}
      langCode={lang}
      onLinkOpen={handleLinkOpen}
      initialData={loadData()}
      viewModeEnabled={!edit}
      onChange={handleChange}
    />
  );
};
