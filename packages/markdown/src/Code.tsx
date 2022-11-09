import { useDirectives } from "@hyperbook/provider";
import { Fragment, useRef, useState } from "react";
import { Components } from "react-markdown";

const MdContentCopy = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      fill="currentColor"
      strokeWidth="0"
      height="1em"
      width="1em"
      viewBox="0 0 24 24"
    >
      <path d="M0 0h24v24H0z" fill="none" />
      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
    </svg>
  );
};

const MdDone = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      fill="currentColor"
      strokeWidth="0"
      height="1em"
      width="1em"
      viewBox="0 0 24 24"
    >
      <path d="M0 0h24v24H0z" fill="none" />
      <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
    </svg>
  );
};

export const Code: Components["code"] = ({ children, className }) => {
  const directives = useDirectives();
  if (className === "language-mermaid" && directives["mermaid"]) {
    const Mermaid = directives["mermaid"];
    return <Mermaid children={children} />;
  }

  const ref = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const copyCode = () => {
    if (navigator.clipboard && ref.current) {
      const text = ref.current.innerText;
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);

        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <Fragment>
      <code ref={ref} className={className}>
        {children}
      </code>
      <button className="copy" onPointerDown={copyCode} aria-label="Copy Code">
        {copied ? <MdDone /> : <MdContentCopy />}
      </button>
    </Fragment>
  );
};
