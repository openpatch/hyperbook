import { PayloadAction } from "@reduxjs/toolkit";
import * as toolkitRaw from "@reduxjs/toolkit";
const { createSlice } = ((toolkitRaw as any).default ??
  toolkitRaw) as typeof toolkitRaw;

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
