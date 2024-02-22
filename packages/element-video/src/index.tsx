import { FC } from "react";
import { createSlice } from "@hyperbook/store";
import { useMakeUrl } from "@hyperbook/provider";
import "./index.css";

type DirectiveVideoProps = {
  src: string;
  title?: string;
  author?: string;
  poster?: string;
};

const DirectiveVideo: FC<DirectiveVideoProps> = ({
  src,
  title,
  author,
  poster,
}) => {
  const makeUrl = useMakeUrl();
  src = makeUrl(src, "public");
  poster = makeUrl(poster, "public");

  return (
    <div className="element-video">
      <div className="player">
        <video controls src={src} poster={poster} width="100%">
          Your browser does not support videos.
        </video>
      </div>
      <div className="information">
        {title && <span className="title">{title}</span>}{" "}
        {title && author && <span className="spacer">-</span>}{" "}
        {author && <span className="author">{author}</span>}{" "}
      </div>
    </div>
  );
};

type ElementVideoState = {};

const initialState: ElementVideoState = {};

const sliceVideo = createSlice({
  name: "element.video",
  initialState,
  reducers: {},
});

export default {
  directives: { video: DirectiveVideo },
  slice: sliceVideo,
};
