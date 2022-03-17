import { useEffect, useMemo } from "react";
import { createStore, Store, Reducer, applyMiddleware } from "redux";
import storage from "redux-persist/lib/storage";
import { persistReducer } from "redux-persist";
import { getHyperbook } from "../utils/hyperbook";
import { DoResult, FlowNode } from "@bitflow/core";
import { DoProgress } from "@bitflow/do";
import { useDispatch, useSelector } from "react-redux";
import { composeWithDevTools } from "@redux-devtools/extension";
import { useRouter } from "next/router";

const config = getHyperbook();

export type PageState = {
  scroll: {
    x: number;
    y: number;
  };
  tabs: Record<string, number>;
  collapsibles: Record<string, boolean>;
  bookmarks: Record<
    string,
    {
      label: string;
      active: boolean;
    }
  >;
  flows: Record<
    string,
    {
      currentNode: FlowNode;
      progress: DoProgress;
      result: DoResult;
    }
  >;
  tasks: Record<
    string,
    {
      answer?: Bitflow.TaskAnswer;
      result?: Bitflow.TaskResult;
    }
  >;
  protect: Record<string, string>;
};

export type HyperbookState = {
  currentPage: string;
  pages: Record<string, PageState>;
};

let store: Store<HyperbookState>;

const defaultState: HyperbookState = {
  pages: {},
  currentPage: "/",
};

// ACTIONS
type ScrollAction = {
  type: "SCROLL";
  payload: {
    x: number;
    y: number;
  };
};

export const scroll = (x: number, y: number): ScrollAction => ({
  type: "SCROLL",
  payload: { x, y },
});

type ToggleCollapsibleAction = {
  type: "TOGGLE_COLLAPSIBLE";
  payload: {
    id: string;
  };
};

export const toggleCollapsible = (id: string): ToggleCollapsibleAction => ({
  type: "TOGGLE_COLLAPSIBLE",
  payload: {
    id,
  },
});

type SetTabAction = {
  type: "SET_TAB";
  payload: {
    id: string;
    tab: number;
  };
};

export const setTab = (id: string, tab: number): SetTabAction => ({
  type: "SET_TAB",
  payload: {
    id,
    tab,
  },
});

type SetCurrentPageAction = {
  type: "SET_CURRENT_PAGE";
  payload: {
    page: string;
  };
};

export const setCurrentPage = (page: string = "/"): SetCurrentPageAction => ({
  type: "SET_CURRENT_PAGE",
  payload: { page },
});

type SetProtectAction = {
  type: "SET_PROTECT";
  payload: {
    id: string;
    value: string;
  };
};

export const setProtect = (id: string, value: string): SetProtectAction => ({
  type: "SET_PROTECT",
  payload: {
    id,
    value,
  },
});

type ToggleBookmarkAction = {
  type: "TOGGLE_BOOKMARK";
  payload: {
    anchor: string;
    label: string;
  };
};

export const toggleBookmark = (
  anchor: string,
  label: string
): ToggleBookmarkAction => ({
  type: "TOGGLE_BOOKMARK",
  payload: {
    anchor,
    label,
  },
});

type Actions =
  | ScrollAction
  | ToggleCollapsibleAction
  | SetTabAction
  | SetProtectAction
  | ToggleBookmarkAction
  | SetCurrentPageAction;

// REDUCER
export const reducer: Reducer<HyperbookState, Actions> = (
  state = defaultState,
  action
) => {
  switch (action.type) {
    case "SET_PROTECT": {
      return {
        ...state,
        pages: {
          ...state.pages,
          [state.currentPage]: {
            ...state.pages?.[state.currentPage],
            protect: {
              ...state.pages?.[state.currentPage]?.protect,
              [action.payload.id]: action.payload.value,
            },
          },
        },
      };
    }
    case "TOGGLE_BOOKMARK": {
      const b =
        state.pages?.[state.currentPage]?.bookmarks?.[action.payload.anchor];
      return {
        ...state,
        pages: {
          ...state.pages,
          [state.currentPage]: {
            ...state.pages?.[state.currentPage],
            bookmarks: {
              ...state.pages?.[state.currentPage]?.bookmarks,
              [action.payload.anchor]: b?.active
                ? {
                    label: action.payload.label,
                    active: false,
                  }
                : {
                    label: action.payload.label,
                    active: true,
                  },
            },
          },
        },
      };
    }
    case "SET_CURRENT_PAGE": {
      return {
        ...state,
        currentPage: action.payload.page,
      };
    }
    case "SCROLL": {
      return {
        ...state,
        pages: {
          ...state.pages,
          [state.currentPage]: {
            ...state.pages?.[state.currentPage],
            scroll: {
              x: action.payload.x,
              y: action.payload.y,
            },
          },
        },
      };
    }
    case "SET_TAB": {
      return {
        ...state,
        pages: {
          ...state.pages,
          [state.currentPage]: {
            ...state.pages?.[state.currentPage],
            tabs: {
              ...state.pages?.[state.currentPage]?.tabs,
              [action.payload.id]: action.payload.tab,
            },
          },
        },
      };
    }
    case "TOGGLE_COLLAPSIBLE": {
      const s =
        state.pages?.[state.currentPage]?.collapsibles?.[action.payload.id];
      return {
        ...state,
        pages: {
          ...state.pages,
          [state.currentPage]: {
            ...state.pages?.[state.currentPage],
            collapsibles: {
              ...state.pages?.[state.currentPage]?.collapsibles,
              [action.payload.id]: s ? !s : true,
            },
          },
        },
      };
    }
    default: {
      return state;
    }
  }
};

// HOOKS
export const usePage = () => {
  const router = useRouter();
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(setCurrentPage(router.asPath.split("#")?.[0] || "/"));
  }, [router.asPath]);
};
export const useTabs = (id: string) => {
  const tab = useSelector<HyperbookState, number>((state) => {
    return state.pages?.[state.currentPage]?.tabs?.[id] || 0;
  });
  const dispatch = useDispatch();

  return [tab, (tab: number) => dispatch(setTab(id, tab))] as const;
};

export const useCollapsible = (id: string) => {
  const collapsed = useSelector<HyperbookState, boolean>((state) => {
    return state.pages?.[state.currentPage]?.collapsibles?.[id] || false;
  });
  const dispatch = useDispatch();

  return [collapsed, () => dispatch(toggleCollapsible(id))] as const;
};

export const useProtect = (id: string) => {
  const protect = useSelector<HyperbookState, string>((state) => {
    return state.pages?.[state.currentPage]?.protect?.[id];
  });
  const dispatch = useDispatch();

  return [protect, (value: string) => dispatch(setProtect(id, value))] as const;
};

export const useBookmark = (anchor: string, label: string) => {
  const bookmark = useSelector<HyperbookState, boolean>((state) => {
    return (
      state.pages?.[state.currentPage]?.bookmarks?.[anchor]?.active || false
    );
  });
  const dispatch = useDispatch();

  return [bookmark, () => dispatch(toggleBookmark(anchor, label))] as const;
};

export const useBookmarks = () => {
  return useSelector<
    HyperbookState,
    { href: string; anchor: string; label: string }[]
  >((state) => {
    return Object.entries(state.pages).flatMap(([href, page]) => {
      if (page) {
        return Object.entries(page.bookmarks)
          .filter(([_, value]) => value.active)
          .flatMap(([anchor, bookmark]) => ({
            href,
            anchor,
            label: bookmark.label,
          }));
      }

      return [];
    });
  });
};

export const useScroll = () => {
  const pos = useSelector<HyperbookState, { x: number; y: number }>((state) => {
    return state.pages?.[state.currentPage]?.scroll;
  });
  const currentPage = useSelector<HyperbookState, string>(
    (state) => state.currentPage
  );
  const dispatch = useDispatch();
  const el = document.getElementsByTagName("main");

  const handleScroll = () => {
    dispatch(scroll(el[0].scrollLeft, el[0].scrollTop));
  };

  useEffect(() => {
    if (pos) {
      el[0].scrollTo({
        top: pos.y,
        left: pos.x,
      });
    }
  }, [currentPage]);

  useEffect(() => {
    el[0].addEventListener("scroll", handleScroll);

    return () => {
      el[0].removeEventListener("scroll", handleScroll);
    };
  }, []);
};

// PERSIST
const persistConfig = {
  key: `hyperbook-${config.version}`,
  storage,
};

const persistedReducer = persistReducer(persistConfig, reducer);

function makeStore(initialState: HyperbookState = defaultState) {
  return createStore(
    persistedReducer,
    initialState as any,
    composeWithDevTools(applyMiddleware())
  );
}

export const initializeStore = (
  preloadedState: HyperbookState = defaultState
) => {
  let _store = store ?? makeStore(preloadedState);

  // After navigating to a page with an initial Redux state, merge that state
  // with the current state in the store, and create a new store
  if (preloadedState && store) {
    _store = makeStore({
      ...store.getState(),
      ...preloadedState,
    });
    // Reset the current store
    store = undefined;
  }

  // For SSG and SSR always create a new store
  if (typeof window === "undefined") return _store;
  // Create the store once in the client
  if (!store) store = _store;

  return _store;
};

export function useStore(initialState: HyperbookState) {
  const store = useMemo(() => initializeStore(initialState), [initialState]);
  return store;
}
