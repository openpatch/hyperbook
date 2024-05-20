import {
  FC,
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createSlice } from "@hyperbook/store";
import type { Slice } from "@reduxjs/toolkit";
import "./index.css";

type DirectiveSlideshowProps = {
  height?: number;
  children?: ReactNode[];
};

const DirectiveSlideshow: FC<DirectiveSlideshowProps> = ({
  children,
  height = 300,
}) => {
  const [active, setActive] = useState(0);
  const imageChildren = children?.filter((c) => c instanceof Object);
  const l = imageChildren?.length || 0;

  const increaseActiveBy = useCallback(
    (value: number) => {
      setActive((active) => {
        if (l == 0) return active;
        if (active + value < 0) {
          return l - 1;
        } else if (active + value >= l) {
          return 0;
        } else {
          return active + value;
        }
      });
    },
    [active, setActive, l]
  );

  return (
    <div className="hyperbook element-slideshow">
      <div className="slideshow fade" style={{ height }}>
        {imageChildren?.map((c, i) => (
          <div
            key={i}
            style={{
              display: active === i ? "block" : "none",
              height: "inherit",
            }}
          >
            {c}
          </div>
        ))}

        <a className="prev" onClick={() => increaseActiveBy(-1)}>
          &#10094;
        </a>
        <a className="next" onClick={() => increaseActiveBy(+1)}>
          &#10095;
        </a>
      </div>

      <div style={{ textAlign: "center" }}>
        {imageChildren?.map((_, i) => (
          <span
            key={i}
            className={`dot ${active === i ? "active" : ""}`}
            onClick={() => setActive(i)}
          ></span>
        ))}
      </div>
    </div>
  );
};

type ElementSlideshowState = {};

const initialState: ElementSlideshowState = {};

const sliceSlideshow = createSlice({
  name: "element.slideshow",
  initialState,
  reducers: {},
});

export default {
  directives: { slideshow: DirectiveSlideshow },
  slice: sliceSlideshow as Slice,
};
