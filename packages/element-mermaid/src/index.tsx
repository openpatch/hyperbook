import { FC, ReactNode, useEffect, useState } from "react";
import { ColorScheme, useColorScheme } from "@hyperbook/provider";
import mermaid from "mermaid";
import "./index.css";

type DirectiveMermaidProps = {
  children?: ReactNode;
};

const getNodeText = (node: any): string => {
  if (["string", "number"].includes(typeof node)) return node;
  if (node instanceof Array) return node.map(getNodeText).join("");
  if (typeof node === "object" && node) return getNodeText(node.props.children);
  return "";
};

let currentId = 0;
const uuid = () => `mermaid-${(currentId++).toString()}`;

const renderMermaid = async (
  graphDefinition: any,
  prefersColorScheme: ColorScheme
): Promise<string> => {
  let html = "";
  if (graphDefinition) {
    try {
      mermaid.mermaidAPI.initialize({
        theme: prefersColorScheme == "dark" ? "dark" : "neutral",
      });
      const { svg } = await mermaid.render(uuid(), graphDefinition);
      return svg;
    } catch (e) {
      console.error(e);
    }
  }
  return html;
};

const DirectiveMermaid: FC<DirectiveMermaidProps> = ({ children }) => {
  const graphDefinition = getNodeText(children);
  const [prefersColorScheme] = useColorScheme();
  const [html, setHtml] = useState("");
  useEffect(() => {
    renderMermaid(graphDefinition, prefersColorScheme).then(setHtml);
  }, [graphDefinition, prefersColorScheme]);

  return graphDefinition ? (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  ) : null;
};

export default {
  directives: { mermaid: DirectiveMermaid },
};
