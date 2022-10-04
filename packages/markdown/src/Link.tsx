import { useLink } from "@hyperbook/provider";
import { Components } from "react-markdown";

export const Link: Components["a"] = ({ href, title, children }) => {
  const L = useLink();
  return (
    <L href={href} title={title}>
      {children}
    </L>
  );
};
