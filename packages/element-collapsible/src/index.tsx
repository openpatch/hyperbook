import { FC, Fragment, ReactNode } from "react";
import hash from "object-hash";
import { useDispatch, useSelector } from "react-redux";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { useActivePageId } from "@hyperbook/provider";
import "./index.css";

type DirectiveCollapsibleProps = {
  children?: ReactNode;
  id: string;
  title: string;
};

const DirectiveCollapsible: FC<DirectiveCollapsibleProps> = ({
  children,
  id,
  title,
}) => {
  const [activePageId] = useActivePageId();

  if (!id) {
    id = title;
  }

  id = activePageId + "." + id;

  let active = useSelector(selectActive(id));
  const dispatch = useDispatch();

  const toggleActive = () => {
    dispatch(sliceCollapsible.actions.toggleActive({ id }));
  };

  return (
    <>
      <button
        id={`collapsibel-${id}`}
        className={[
          "element-collapsible",
          "button",
          active ? "active" : "",
        ].join(" ")}
        onClick={() => toggleActive()}
      >
        {title}
      </button>
      <div
        className={[
          "element-collapsible",
          "content",
          active ? "active" : "",
        ].join(" ")}
      >
        <div className={"inner"}>{children}</div>
      </div>
    </>
  );
};

type ElementCollapsibleState = Record<string, string>;

const initialState: ElementCollapsibleState = {};

const sliceCollapsible = createSlice({
  name: "element.collapsible",
  initialState,
  reducers: {
    toggleActive: (state, action: PayloadAction<{ id: string }>) => {
      state[action.payload.id] = !(state[action.payload.id] || false);
    },
  },
});

const selectActive =
  (tab: string) =>
  (state: { "element.collapsible": ElementCollapsibleState }) => {
    return state[sliceCollapsible.name][tab];
  };

export default {
  directives: { collapsible: DirectiveCollapsible },
  slice: sliceCollapsible,
};
