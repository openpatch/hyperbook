import { combineReducers } from "redux";
import { persistReducer, persistStore, Storage } from "redux-persist";
import { configureStore as reduxConfigureStore } from "@reduxjs/toolkit";
import { Reducer } from "react";

import { activePageSlice } from "./slices/activePage";
import { bookmarksSlice } from "./slices/bookmarks";

export const makeStore = (
  reducers: Record<string, Reducer<any, any>>,
  storage: Storage
) => {
  const store = reduxConfigureStore({
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
