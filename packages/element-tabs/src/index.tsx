import { FC, Fragment, ReactNode } from "react";
import { createSlice } from "@hyperbook/store";
import type { Slice, PayloadAction } from "@reduxjs/toolkit";
import { useActivePageId } from "@hyperbook/provider";
import hash from "object-hash";
import { useDispatch, useSelector } from "react-redux";
import "./index.css";

type DirectiveTabsProps = {
  children?: ReactNode;
  node: any;
  id: string;
};

const DirectiveTabs: FC<DirectiveTabsProps> = ({ id, node, children }) => {
  const [activePageId] = useActivePageId();

  if (!id) {
    id = hash(node);
  }

  id = activePageId + "." + id;

  let activeTab = useSelector(selectActive(id));
  const dispatch = useDispatch();

  const tabs: { title: string; id: string; index: number }[] =
    node.children?.map((c: any, i: number) => {
      return {
        title: c.properties?.title || "",
        id: c.properties?.id || c.properties?.title,
        index: i,
      };
    });

  const setActiveTab = (tab: string) => {
    dispatch(sliceTabs.actions.setActive({ id, tab }));
  };

  if (activeTab == null) {
    activeTab = tabs?.[0]?.id;
  }

  return (
    <div className="hyperbook element-tabs">
      <div className="tabs" id={`tabs-${id}`}>
        {tabs.map(({ title, id, index }) => (
          <button
            key={index + id}
            className={activeTab === id ? "tab active" : "tab"}
            onClick={() => setActiveTab(id)}
          >
            {title}
          </button>
        ))}
      </div>
      {tabs?.map(
        ({ id, index }) =>
          activeTab === id && (
            <div className="tabpanel" key={index + id}>
              {(children as any)?.[index]}
            </div>
          )
      )}
    </div>
  );
};

type DirectiveTabProps = {
  children?: ReactNode;
};

const DirectiveTab: FC<DirectiveTabProps> = ({ children }) => {
  return <Fragment>{children}</Fragment>;
};

type ElementTabsState = Record<string, string>;

const initialState: ElementTabsState = {};

const sliceTabs = createSlice({
  name: "element.tabs",
  initialState,
  reducers: {
    setActive: (state, action: PayloadAction<{ id: string; tab: string }>) => {
      state[action.payload.id] = action.payload.tab;
    },
  },
});

const selectActive =
  (tab: string) => (state: { "element.tabs": ElementTabsState }) => {
    return state?.[sliceTabs.name]?.[tab];
  };

export default {
  directives: { tabs: DirectiveTabs, tab: DirectiveTab },
  slice: sliceTabs as Slice,
};
