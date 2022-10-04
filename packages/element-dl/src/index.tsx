import { useMakeUrl } from "@hyperbook/provider";
import { FC, ReactNode, useEffect, useState } from "react";
import "./index.css";

type DirectiveDownloadProps = {
  children?: ReactNode;
  src: string;
};

const DirectiveDownload: FC<DirectiveDownloadProps> = ({ children, src }) => {
  const [isOnline, setIsOnline] = useState(true);
  const makeUrl = useMakeUrl();

  src = makeUrl(src, "public");

  useEffect(() => {
    let isCancelled = false;
    fetch(src, {
      method: "HEAD",
    }).then((r) => {
      if (!r.ok && !isCancelled) {
        setIsOnline(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <a
      href={src}
      className="element-download"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="icon">⏬</span>
      <span className={!isOnline ? "label offline" : "label"}>
        {children} {!isOnline && "(Offline)"}
      </span>
    </a>
  );
};

type DirectiveArchiveProps = {
  name: string;
  children: ReactNode;
};

const DirectiveArchive: FC<DirectiveArchiveProps> = ({ name, children }) => {
  return (
    <DirectiveDownload children={children} src={`/archives/${name}.zip`} />
  );
};

export default {
  directives: { download: DirectiveDownload, archive: DirectiveArchive },
};
