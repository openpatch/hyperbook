import { FC, ReactNode } from "react";
import { createSlice } from "@hyperbook/store";
import "./index.css";
import { encode } from "./encode";
import type { Slice } from "@reduxjs/toolkit";

const getNodeText = (node: any): string => {
  if (["string", "number"].includes(typeof node)) return node;
  if (node instanceof Array) return node.map(getNodeText).join("");
  if (typeof node === "object" && node) return getNodeText(node.props.children);
  return "";
};

type DirectivePlantumlProps = {
  children?: ReactNode;
  alt?: string;
  width?: string;
};

const DirectivePlantuml: FC<DirectivePlantumlProps> = ({
  children,
  alt,
  width,
}) => {
  let text = getNodeText(children);
  const url = `https://kroki.io/plantuml/svg/${encode(text)}`;

  return (
    <div className="element-plantuml">
      <img alt={alt} src={url} width={width} />
    </div>
  );
};

type ElementPlantumlState = {};

const initialState: ElementPlantumlState = {};

const slicePlantuml = createSlice({
  name: "element.plantuml",
  initialState,
  reducers: {},
});

export default {
  directives: { plantuml: DirectivePlantuml },
  slice: slicePlantuml as Slice,
};
