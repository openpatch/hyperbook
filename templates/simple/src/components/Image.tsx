import config from "../../hyperbook.json";

export const Image = ({ src, title, node, ...props }) => {
  const { basePath } = config;

  if (
    process.env.NODE_ENV !== "production" &&
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
      <img src={src} alt={node?.properties?.alt} />
      {title && <figcaption>{title}</figcaption>}
    </figure>
  );
};
