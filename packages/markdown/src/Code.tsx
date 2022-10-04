import { useDirectives } from "@hyperbook/provider";
import React, { Fragment, useRef, useState } from "react";
import { Components } from "react-markdown";
import { MdContentCopy, MdDone } from "react-icons/md";

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
      navigator.clipboard.writeText(text);

      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Fragment>
      <code ref={ref} className={className}>
        {children}
      </code>
      <button className="copy" onClick={copyCode} aria-label="Copy Code">
        {copied ? <MdDone /> : <MdContentCopy />}
      </button>
    </Fragment>
  );
};
