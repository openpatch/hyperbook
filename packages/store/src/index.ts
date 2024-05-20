import { combineReducers } from "redux";
import { persistReducer, persistStore, Storage } from "redux-persist";
export { createSlice } from "@reduxjs/toolkit";
import { configureStore } from "@reduxjs/toolkit";
import { Reducer } from "react";
export type { Storage } from "redux-persist";

export * from "./storage";
export * from "./react";

import { noopStorage } from "./storage";

import { activePageSlice } from "./slices/activePage";
import { bookmarksSlice } from "./slices/bookmarks";

export const makeStore = (
  reducers: Record<string, Reducer<any, any>>,
  storage: Storage = noopStorage
) => {
  const store = configureStore({
    reducer: persistReducer(
      { key: "hyperbook", storage },
      combineReducers({
        [activePageSlice.name]: activePageSlice.reducer,
        [bookmarksSlice.name]: bookmarksSlice.reducer,
        ...reducers,
      })
    ),
    middleware: (getDefaultModdleware) =>
      getDefaultModdleware({
        serializableCheck: false,
      }),
  });

  const persistor = persistStore(store);

  return {
    store,
    persistor,
  };
};

export * from "./slices/activePage";
export * from "./slices/bookmarks";
