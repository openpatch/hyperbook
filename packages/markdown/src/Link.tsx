import { useConfig, useLink } from "@hyperbook/provider";
import type { Components } from "hast-util-to-jsx-runtime";
import { ReactNode, useEffect, useState } from "react";

// see: https://css-tricks.com/better-line-breaks-for-long-urls/
function formatUrl(url: string): string {
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
          .replace(/(?<beforeAndAfter>[=&])/giu, "<wbr>$1<wbr>"),
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
        !window.location.pathname?.startsWith(config.basePath)
      ) {
        setIsExternal(true);
      } else {
        setIsExternal(false);
      }
    }
  }, [href, config]);

  if (typeof children !== "string") {
    return (
      <L href={href} title={title} target={isExternal ? "_blank" : undefined}>
        {children}
      </L>
    );
  }

  return (
    <L
      href={href}
      title={title}
      dangerouslySetInnerHTML={{
        __html: formatUrl(children),
      }}
      target={isExternal ? "_blank" : undefined}
    />
  );
};
