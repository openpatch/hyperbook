import { FC, Fragment, ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import hash from "object-hash";
import { useActivePageId } from "@hyperbook/provider";
import "./index.css";

type DirectiveProtectProps = {
  children?: ReactNode;
  password: string;
  description?: string;
  node: any;
};

const DirectiveProtect: FC<DirectiveProtectProps> = ({
  children,
  description,
  node,
  password,
}) => {
  const [activePageId] = useActivePageId();
  const dispatch = useDispatch();
  const id = `${activePageId}.${hash(node)}`;
  const value = useSelector(selectValue(id));

  const setValue = (value: string) => {
    dispatch(sliceProtect.actions.set({ id, value }));
  };

  return value === password ? (
    <>{children}</>
  ) : (
    <div className="element-protect">
      <span className="description">{description}</span>
      <span className="icon">🔒</span>
      <input
        placeholder="..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
};

type ElementProtectState = Record<string, string>;

const initialState: ElementProtectState = {};

const sliceProtect = createSlice({
  name: "element.protect",
  initialState,
  reducers: {
    set: (state, action: PayloadAction<{ id: string; value: string }>) => {
      state[action.payload.id] = action.payload.value;
    },
  },
});

const selectValue =
  (id: string) => (state: { "element.protect": ElementProtectState }) => {
    return state[sliceProtect.name][id] || "";
  };

export default {
  directives: { protect: DirectiveProtect },
  slice: sliceProtect,
};
