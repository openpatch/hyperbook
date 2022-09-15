import { Components } from "react-markdown";
import { getHyperbookUrl } from "../utils/hyperbook";

export const Image: Components["img"] = ({ src, title, alt }) => {
  src = getHyperbookUrl(src);

  return (
    <figure>
      <img src={src} alt={alt} />
      {title && <figcaption>{title}</figcaption>}
    </figure>
  );
};
