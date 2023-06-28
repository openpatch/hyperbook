import { useMakeUrl } from "@hyperbook/provider";
import { ComponentType, useState } from "react";

export const Image: ComponentType<JSX.IntrinsicElements["img"]> = ({
  src,
  title,
  alt,
}) => {
  const makeUrl = useMakeUrl();
  const [full, setFull] = useState(false);
  src = makeUrl(src, "public");

  return (
    <figure className={full ? "lightbox" : undefined}>
      <img src={src} alt={alt} onClick={() => setFull((f) => !f)} />
      {title && <figcaption>{title}</figcaption>}
    </figure>
  );
};
