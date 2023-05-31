import { FC } from "react";
import { createSlice } from "@reduxjs/toolkit";
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
  width,
  height,
  title,
  allowFullScreen = true,
  aspectRatio,
}) => {
  return (
    <div className="element-embed" style={{ aspectRatio }}>
      <iframe
        src={src}
        title={title}
        width={width}
        height={height}
        allowFullScreen={allowFullScreen}
      />
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
  slice: sliceEmbed,
};
