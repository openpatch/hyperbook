import { FC } from "react";
import { createSlice } from "@hyperbook/store";
import type { Slice } from "@reduxjs/toolkit";
import "./index.css";

type DirectiveEmbedProps = {
  src?: string;
  height?: string | number;
  width?: string | number;
  title?: string;
  allowFullScreen?: boolean;
  aspectRatio?: string;
};

const DirectiveEmbed: FC<DirectiveEmbedProps> = ({
  src,
  width = "100%",
  height = "400px",
  title,
  allowFullScreen = true,
  aspectRatio,
}) => {
  return (
    <div className="element-embed" style={{ aspectRatio, width, height }}>
      <iframe src={src} title={title} allowFullScreen={allowFullScreen} />
    </div>
  );
};

type ElementEmbedState = {};

const initialState: ElementEmbedState = {};

const sliceEmbed = createSlice({
  name: "element.embed",
  initialState,
  reducers: {},
});

export default {
  directives: { embed: DirectiveEmbed },
  slice: sliceEmbed as Slice,
};
