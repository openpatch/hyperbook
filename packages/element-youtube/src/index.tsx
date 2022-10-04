import { FC, ReactNode } from "react";
import "./index.css";

type DirectiveYoutubeProps = {
  children?: ReactNode;
  id: string;
};

const DirectiveYoutube: FC<DirectiveYoutubeProps> = ({ children, id }) => {
  return (
    <div className="hyperbook element-youtube" id={`video-${id}`}>
      <iframe
        src={"https://www.youtube.com/embed/" + id}
        frameBorder="0"
        title={children?.toString()}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      />
    </div>
  );
};

export default {
  directives: { youtube: DirectiveYoutube },
};
