import { Components } from "react-markdown";
import { getHyperbook } from "../utils/hyperbook";

const config = getHyperbook();

export const Image: Components["img"] = ({ src, title, alt }) => {
  const { basePath } = config;

  if (
    process.env.NODE_ENV === "production" &&
    basePath &&
    src.startsWith("/")
  ) {
    if (basePath.endsWith("/")) {
      src = basePath.slice(0, -1) + src;
    } else {
      src = basePath + src;
    }
  }

  return (
    <figure>
      <img src={src} alt={alt} />
      {title && <figcaption>{title}</figcaption>}
    </figure>
  );
};
