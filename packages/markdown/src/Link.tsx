import { useConfig, useLink } from "@hyperbook/provider";
import { ReactNode, useEffect, useState } from "react";
import { Components } from "react-markdown";

// see: https://css-tricks.com/better-line-breaks-for-long-urls/
function formatUrl(url: ReactNode) {
  if (typeof url !== "string") {
    return url;
  }
  // Split the URL into an array to distinguish double slashes from single slashes
  var doubleSlash = url.split("//");

  // Format the strings on either side of double slashes separately
  var formatted = doubleSlash
    .map(
      (str) =>
        // Insert a word break opportunity after a colon
        str
          .replace(/(?<after>:)/giu, "$1<wbr>")
          // Before a single slash, tilde, period, comma, hyphen, underline, question mark, number sign, or percent symbol
          .replace(/(?<before>[/~.,\-_?#%])/giu, "<wbr>$1")
          // Before and after an equals sign or ampersand
          .replace(/(?<beforeAndAfter>[=&])/giu, "<wbr>$1<wbr>")
      // Reconnect the strings with word break opportunities after double slashes
    )
    .join("//<wbr>");

  return formatted;
}

export const Link: Components["a"] = ({ href, title, children }) => {
  const L = useLink();
  const config = useConfig();
  const [isExternal, setIsExternal] = useState(false);

  useEffect(() => {
    if (href) {
      const tmp = document.createElement("a");
      tmp.href = href;
      if (tmp.host !== window.location.host) {
        setIsExternal(true);
      } else if (
        config.basePath &&
        !window.location.pathname.startsWith(config.basePath)
      ) {
        setIsExternal(true);
      } else {
        setIsExternal(false);
      }
    }
  }, [href, config]);

  if (isExternal) {
    <L href={href} title={title} target="_blank">
      {formatUrl(children)}
    </L>;
  }

  return (
    <L href={href} title={title}>
      {formatUrl(children)}
    </L>
  );
};
