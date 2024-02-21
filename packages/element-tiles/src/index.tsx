import { FC, Fragment, ReactNode } from "react";
import { createSlice } from "@hyperbook/store";
import "./index.css";

type DirectiveTilesProps = {
  children?: ReactNode;
};

const DirectiveTiles: FC<DirectiveTilesProps> = ({ children }) => {
  return (
    <div className="hyperbook element-tiles">
      <ul className="tiles">{children}</ul>
    </div>
  );
};

type DirectiveTileProps = {
  size?: "S" | "M" | "L";
  title?: string;
  description?: string;
  href?: string;
  icon?: string;
};

const DirectiveTile: FC<DirectiveTileProps> = ({
  size = "M",
  title,
  href,
  icon,
}) => {
  return (
    <li className={`tile ${size} ${href ? "link" : ""}`}>
      <a className="tile-title" href={href}>
        {title}
      </a>
      {icon && <img className="tile-icon" src={icon} />}
    </li>
  );
};

type ElementTilesState = {};

const initialState: ElementTilesState = {};

const sliceTiles = createSlice({
  name: "element.tiles",
  initialState,
  reducers: {},
});

export default {
  directives: { tiles: DirectiveTiles, tile: DirectiveTile },
  slice: sliceTiles,
};
