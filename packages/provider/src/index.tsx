import {
  FC,
  ReactNode,
  Reducer,
  useContext,
  useEffect,
  useState,
  createContext,
} from "react";
import {
  Provider as ReduxProvider,
  useDispatch,
  useSelector,
} from "react-redux";
import {
  activePageSlice,
  bookmarksSlice,
  makeStore,
  selectActivePage,
  selectBookmark,
  BookmarksState,
  Slice,
  PersistGate,
  Storage,
} from "@hyperbook/store";
import { HyperbookJson } from "@hyperbook/types";

export type RootFolder = "public" | "book" | "glossary";

type HyperbookContextProps = {
  directives: Record<string, FC<any>>;
  Link: FC<JSX.IntrinsicElements["a"]>;
  env: "development" | "production";
  router: {
    push: (path: string) => Promise<boolean>;
  };
  colorScheme?: "dark" | "light";
  saveFile: (
    config: HyperbookJson
  ) => (path: string, content: string, rootFolder: RootFolder) => Promise<void>;
  loadFile: (
    config: HyperbookJson
  ) => (path: string, rootFolder?: RootFolder) => Promise<string>;
  makeUrl: (
    config: HyperbookJson
  ) => (path?: string, rootFolder?: RootFolder) => string;
  getActivePageId: () => Promise<string>;
  config: HyperbookJson;
};

const HyperbookContext = createContext<HyperbookContextProps>({
  directives: {},
  Link: (props) => <a {...props} />,
  router: {
    push: async () => false,
  },
  env: "production",
  saveFile: () => async () => {},
  loadFile: () => async () => "",
  makeUrl: () => (url) => url || "",
  getActivePageId: async () => "",
  config: {
    name: "Hyperbook",
  },
});

export type Element = {
  directives: Record<string, FC<any>>;
  slice?: Slice;
};

export type ProviderProps = {
  Link: HyperbookContextProps["Link"];
  router: HyperbookContextProps["router"];
  elements?: Element[];
  children?: ReactNode;
  saveFile?: HyperbookContextProps["saveFile"];
  loadFile?: HyperbookContextProps["loadFile"];
  makeUrl?: HyperbookContextProps["makeUrl"];
  getActivePageId?: HyperbookContextProps["getActivePageId"];
  config?: HyperbookContextProps["config"];
  env?: HyperbookContextProps["env"];
  storage?: Storage;
};

export const Provider: FC<ProviderProps> = ({
  elements = [],
  children,
  Link,
  saveFile = () => async () => {},
  loadFile = () => async () => "",
  router,
  env = "production",
  makeUrl = () => (url) => url || "",
  getActivePageId = async () => "",
  config = {
    name: "Hyperbook",
  },
  storage,
}) => {
  const directiveReducers: Record<string, Reducer<any, any>> = {};
  let directiveComponents: Record<string, FC<any>> = {};
  elements.forEach((element) => {
    if (element.slice) {
      directiveReducers[element.slice.name] = element.slice.reducer;
    }
    directiveComponents = {
      ...directiveComponents,
      ...element.directives,
    };
  });

  const { store, persistor } = makeStore(directiveReducers, storage);

  return (
    <ReduxProvider store={store}>
      <HyperbookContext.Provider
        value={{
          directives: directiveComponents,
          router,
          Link,
          saveFile,
          loadFile,
          makeUrl,
          getActivePageId,
          config,
          env,
        }}
      >
        <PersistGate
          loading={<div className="hyperbook loading">...</div>}
          persistor={persistor}
        >
          {children}
        </PersistGate>
      </HyperbookContext.Provider>
    </ReduxProvider>
  );
};

export const useEnv = () => {
  const data = useContext(HyperbookContext);
  return data.env;
};

export const useBookmark = (
  anchor: string,
  label: string
): [boolean, () => void] => {
  const dispatch = useDispatch();
  const [activePageId] = useActivePageId();
  const key = `${activePageId}#${anchor}`;
  const bookmark = useSelector(selectBookmark(key));

  const toggle = () => {
    dispatch(bookmarksSlice.actions.toggle({ key, label }));
  };

  return [bookmark?.active || false, toggle];
};

export const useBookmarks = () => {
  const bookmarks = useSelector(
    (state: { bookmarks: BookmarksState }) => state.bookmarks
  );

  return Object.entries(bookmarks)
    .map(([key, bookmark]) => {
      return {
        href: key,
        ...bookmark,
      };
    })
    .filter((bookmark) => bookmark.active);
};

export const useActivePageId = (auto: boolean = true) => {
  const data = useContext(HyperbookContext);
  const dispatch = useDispatch();
  const activePageId = useSelector(selectActivePage);

  const setActivePageId = (pageId: string) => {
    dispatch(activePageSlice.actions.set(pageId));
  };

  useEffect(() => {
    if (auto) {
      data
        .getActivePageId()
        .then(setActivePageId)
        .catch(() => {});
    }
  }, [auto]);

  return [activePageId, setActivePageId];
};

export const useConfig = () => {
  const data = useContext(HyperbookContext);

  return data.config;
};

export const useLink = () => {
  const data = useContext(HyperbookContext);

  return data.Link;
};

export const useRouter = () => {
  const data = useContext(HyperbookContext);

  return data.router;
};

export const useDirectives = () => {
  const data = useContext(HyperbookContext);

  return data.directives;
};

export const useMakeUrl = () => {
  const data = useContext(HyperbookContext);
  return data.makeUrl(data.config);
};

export const useFile = () => {
  const data = useContext(HyperbookContext);

  return [data.loadFile(data.config), data.saveFile(data.config)] as const;
};

export type ColorScheme = "light" | "dark";

export function useColorScheme(): [ColorScheme] {
  const [preferredColorScheme, setPreferredColorScheme] =
    useState<ColorScheme>("light");

  useEffect(() => {
    if (!window.matchMedia) {
      setPreferredColorScheme("light");
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    setPreferredColorScheme(mediaQuery.matches ? "dark" : "light");

    function onChange(event: MediaQueryListEvent): void {
      setPreferredColorScheme(event.matches ? "dark" : "light");
    }

    mediaQuery.addEventListener("change", onChange);

    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  return [preferredColorScheme];
}
