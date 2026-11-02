import {
  Excalidraw,
  CaptureUpdateAction,
  MainMenu,
  languages,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExcalidrawImperativeAPI,
  type ExcalidrawProps as EDP,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";

type HyperbookExcalidrawProps = {
  id: string;
  lang: string;
  autoZoom: boolean;
  edit: boolean;
  src: string;
  onlinkopen: (link: string) => void;
  resetLabel?: string;
  resetPrompt?: string;
  // Registered as custom-element props in index.ts but handled internally.
  onChange?: EDP["onChange"];
  value?: unknown;
};

export const HyperbookExcalidraw: FC<HyperbookExcalidrawProps> = ({
  id,
  lang = "en",
  autoZoom = true,
  edit = false,
  src,
  onlinkopen = () => {},
  resetLabel = "Reset to template",
  resetPrompt = "Are you sure you want to reset the drawing to its template? Your changes will be lost.",
}) => {
  const [api, setApi] = useState<ExcalidrawImperativeAPI>();
  // Bumped by a reset: remounts the canvas, which then loads the template
  // again since the saved drawing is gone.
  const [generation, setGeneration] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (!id) id = src;
  // Before ids were passed through, drawings were saved under `src`.
  const legacyId = src && src !== id ? src : undefined;

  // Excalidraw knows "de-DE", a book says "de"; an unknown code would fall back
  // to English and set the page's `lang` to "en".
  const langCode =
    languages.find((l) => l.code === lang)?.code ||
    languages.find((l) => l.code.startsWith(`${lang}-`))?.code ||
    "en";

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
      const result =
        (await store.db.excalidraw.get(id)) ||
        (legacyId && (await store.db.excalidraw.get(legacyId)));
      if (result) {
        return {
          elements: result.elements,
          files: result.files,
          scrollToContent: autoZoom,
          appState: {
            // Older versions saved the app state as `state`.
            ...(result.appState ?? result.state),
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

  // Loaded once per mount, not on every render.
  const initialData = useMemo(loadData, [generation]);

  const handleChange: EDP["onChange"] = (elements, appState, files) => {
    if (!edit || !id) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // Same shape as a .excalidraw file: deleted elements and transient UI
      // state (open dialogs, collaborators, ...) are left out.
      const scene = JSON.parse(
        serializeAsJSON(elements, appState, files, "local"),
      );
      const store = (window as any).hyperbook.store;
      store.db.excalidraw.put({
        id,
        elements: scene.elements,
        appState: scene.appState,
        files: scene.files,
      });
    }, 300);
  };

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const handleReset = async () => {
    if (!window.confirm(resetPrompt)) return;
    clearTimeout(saveTimer.current);
    const store = (window as any).hyperbook.store;
    await store.db.excalidraw.delete(id);
    if (legacyId) await store.db.excalidraw.delete(legacyId);
    setGeneration((g) => g + 1);
  };

  return (
    <Excalidraw
      key={generation}
      excalidrawAPI={(api) => setApi(api)}
      langCode={langCode}
      onLinkOpen={handleLinkOpen}
      initialData={initialData}
      viewModeEnabled={!edit}
      onChange={handleChange}
    >
      {edit && src && (
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveToActiveFile />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Item icon={resetIcon} onSelect={handleReset}>
            {resetLabel}
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
      )}
    </Excalidraw>
  );
};

// Counter-clockwise arrow, drawn like Excalidraw's own menu icons.
const resetIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    role="img"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
