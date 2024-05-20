import { useMakeUrl } from "@hyperbook/provider";
import { useState } from "react";
import type { Components } from "hast-util-to-jsx-runtime";

export const Image: Components["img"] = ({ src, title, alt }) => {
  const makeUrl = useMakeUrl();
  const [full, setFull] = useState(false);
  src = makeUrl(src, "public");

  return (
    <>
      {full && (
        <figure className={"lightbox"}>
          <img src={src} alt={alt} onClick={() => setFull((f) => !f)} />
          {title && <figcaption>{title}</figcaption>}
        </figure>
      )}
      <figure className={"normal"}>
        <img src={src} alt={alt} onClick={() => setFull((f) => !f)} />
        {title && <figcaption>{title}</figcaption>}
      </figure>
    </>
  );
};
