import { useMakeUrl } from "@hyperbook/provider";
import { Components } from "react-markdown";

export const Image: Components["img"] = ({ src, title, alt }) => {
  const makeUrl = useMakeUrl();
  src = makeUrl(src, "public");

  return (
    <figure>
      <img src={src} alt={alt} />
      {title && <figcaption>{title}</figcaption>}
    </figure>
  );
};
