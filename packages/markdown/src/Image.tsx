import { useMakeUrl } from "@hyperbook/provider";
import { useState } from "react";
import { Components } from "react-markdown";

export const Image: Components["img"] = ({ src, title, alt }) => {
  const makeUrl = useMakeUrl();
  const [full, setFull] = useState(false);
  src = makeUrl(src, "public");

  return (
    <figure
      onClick={() => setFull((f) => !f)}
      className={full ? "lightbox" : undefined}
    >
      <img src={src} alt={alt} />
      {title && <figcaption>{title}</figcaption>}
    </figure>
  );
};
