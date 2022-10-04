import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type ActivePageState = {
  id: string;
};

const initialState: ActivePageState = {
  id: "",
};

export const activePageSlice = createSlice({
  name: "activePage",
  initialState,
  reducers: {
    set: (state, action: PayloadAction<string>) => {
      state.id = action.payload;
    },
  },
});

export const selectActivePage = (state: { activePage: ActivePageState }) =>
  state[activePageSlice.name].id;
