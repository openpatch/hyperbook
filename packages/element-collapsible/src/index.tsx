import { FC, ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createSlice, PayloadAction } from "@hyperbook/store";
import { useActivePageId } from "@hyperbook/provider";
import "./index.css";
import { useCollapse } from "react-collapsed";

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
  if (!id) {
    id = title;
  }

  const [activePageId] = useActivePageId();
  id = activePageId + "." + id;

  let active = useSelector(selectActive(id));
  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse({
    isExpanded: active ? true : false,
  });

  const dispatch = useDispatch();

  const toggleActive = () => {
    dispatch(sliceCollapsible.actions.toggleActive({ id }));
  };

  return (
    <>
      <button
        className={[
          "element-collapsible",
          "button",
          isExpanded ? "active" : "",
        ].join(" ")}
        {...getToggleProps({
          onClick: () => toggleActive(),
        })}
      >
        {title}
      </button>
      <div
        className={[
          "element-collapsible",
          "content",
          isExpanded ? "active" : "",
        ].join(" ")}
        {...getCollapseProps()}
      >
        <div className={"inner"}>{children}</div>
      </div>
    </>
  );
};

type ElementCollapsibleState = Record<string, boolean>;

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
