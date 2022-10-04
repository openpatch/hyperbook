import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type BookmarksState = Record<
  string,
  {
    label: string;
    active: boolean;
  }
>;

const initialState: BookmarksState = {};

export const bookmarksSlice = createSlice({
  name: "bookmarks",
  initialState,
  reducers: {
    toggle: (
      state,
      action: PayloadAction<{
        key: string;
        label: string;
      }>
    ) => {
      const { key, label } = action.payload;
      if (!state[key] || !state[key].active) {
        state[key] = {
          label,
          active: true,
        };
      } else {
        state[key] = {
          label,
          active: false,
        };
      }
    },
  },
});

export const selectBookmark =
  (key: string) => (state: { bookmarks: BookmarksState }) =>
    state[bookmarksSlice.name][key];
