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
  fullscreenLabel?: string;
  fullscreenExitLabel?: string;
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
  fullscreenLabel = "Fullscreen",
  fullscreenExitLabel = "Exit fullscreen",
}) => {
  const [api, setApi] = useState<ExcalidrawImperativeAPI>();
  // Bumped by a reset: remounts the canvas, which then loads the template
  // again since the saved drawing is gone.
  const [generation, setGeneration] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hostRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Excalidraw maps pointer positions to the canvas with an offset it measures
  // once and then only on scrolls of one container. Content above the drawing
  // that changes height (a late image, a collapsible) moves the canvas without
  // a scroll, and the stale offset puts strokes, text and images in the wrong
  // place; a text box opened above the viewport scrolls the page up when it
  // takes focus. Measuring again before every interaction keeps it right.
  useEffect(() => {
    const host = hostRef.current;
    if (!api || !host) return;

    let frame = 0;
    const refreshNow = () => api.refresh();
    const refreshSoon = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refreshNow);
    };

    host.addEventListener("pointerdown", refreshNow, true);
    host.addEventListener("pointerenter", refreshNow, true);
    host.addEventListener("dragenter", refreshNow, true);
    document.addEventListener("scroll", refreshSoon, true);
    window.addEventListener("resize", refreshSoon);
    const observer = new ResizeObserver(refreshSoon);
    observer.observe(document.body);

    return () => {
      cancelAnimationFrame(frame);
      host.removeEventListener("pointerdown", refreshNow, true);
      host.removeEventListener("pointerenter", refreshNow, true);
      host.removeEventListener("dragenter", refreshNow, true);
      document.removeEventListener("scroll", refreshSoon, true);
      window.removeEventListener("resize", refreshSoon);
      observer.disconnect();
    };
  }, [api]);

  // The bordered box the directive renders goes fullscreen, not just the
  // canvas, so it keeps its frame; the custom element is the fallback outside
  // a book.
  const fullscreenTarget = () => {
    const host = hostRef.current;
    return (host?.closest(".directive-excalidraw") ||
      host?.parentElement) as HTMLElement | null;
  };

  useEffect(() => {
    // Escape and F11 leave fullscreen without the button, so the state is read
    // back from the browser rather than tracked.
    const sync = () =>
      setIsFullscreen(
        !!document.fullscreenElement &&
          document.fullscreenElement === fullscreenTarget(),
      );
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = async () => {
    const target = fullscreenTarget();
    if (!target) return;
    if (document.fullscreenElement === target) {
      await document.exitFullscreen();
    } else {
      await target.requestFullscreen();
    }
  };

  const renderTopRightUI = () => {
    const label = isFullscreen ? fullscreenExitLabel : fullscreenLabel;
    return (
      <button
        type="button"
        className="sidebar-trigger hyperbook-excalidraw-fullscreen"
        title={label}
        aria-label={label}
        aria-pressed={isFullscreen}
        onClick={toggleFullscreen}
      >
        {isFullscreen ? exitFullscreenIcon : fullscreenIcon}
      </button>
    );
  };

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
    // `display: contents` keeps the layout as before; the div only gives the
    // offset refresh above an element to listen on.
    <div ref={hostRef} style={{ display: "contents" }}>
    <Excalidraw
      key={generation}
      excalidrawAPI={(api) => setApi(api)}
      langCode={langCode}
      onLinkOpen={handleLinkOpen}
      initialData={initialData}
      viewModeEnabled={!edit}
      onChange={handleChange}
      renderTopRightUI={
        document.fullscreenEnabled ? renderTopRightUI : undefined
      }
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
    </div>
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

const fullscreenIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);

const exitFullscreenIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </svg>
);
