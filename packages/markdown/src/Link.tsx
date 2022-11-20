import { useLink } from "@hyperbook/provider";
import { Components } from "react-markdown";

// see: https://css-tricks.com/better-line-breaks-for-long-urls/
function formatUrl(url: string) {
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

  if (href) {
    href = formatUrl(href);
  }

  return (
    <L href={href} title={title}>
      {children}
    </L>
  );
};
