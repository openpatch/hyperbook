import { FC, ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createSlice, PayloadAction } from "@hyperbook/store";
import { useActivePageId } from "@hyperbook/provider";
import "./index.css";
import useCollapse from "react-collapsed";

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
  const { getCollapseProps, getToggleProps } = useCollapse({
    isExpanded: active,
  });

  const dispatch = useDispatch();

  const toggleActive = () => {
    dispatch(sliceCollapsible.actions.toggleActive({ id }));
  };

  return (
    <>
      <button
        {...getToggleProps({
          onClick: () => toggleActive(),
        })}
        className={[
          "element-collapsible",
          "button",
          active ? "active" : "",
        ].join(" ")}
      >
        {title}
      </button>
      <div
        {...getCollapseProps()}
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
