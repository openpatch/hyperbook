import { useConfig } from "@hyperbook/provider";
import { FC, ReactNode, useEffect, useRef } from "react";
import "./index.css";

type DirectiveScratchblockProps = {
  children?: ReactNode;
  language?: string;
};

const getNodeText = (node: any): string => {
  if (["string", "number"].includes(typeof node)) return node;
  if (node instanceof Array) return node.map(getNodeText).join("");
  if (typeof node === "object" && node) return getNodeText(node.props.children);
  return "";
};

const renderScratchblock = async (
  text: string,
  options: any
): Promise<SVGElement> => {
  const scratchblocks = (await import("scratchblocks")).default;
  const languages: Record<string, any> = {};
  for (let language of options.languages) {
    try {
      const l = (await import(`scratchblocks/locales/${language}.json`))
        .default;
      languages[language] = l;
    } catch (e) {}
  }
  scratchblocks.loadLanguages(languages);
  const doc = scratchblocks.parse(text, options);
  const svg = scratchblocks.render(doc, options);
  return svg;
};

const DirectiveScratchblock: FC<DirectiveScratchblockProps> = ({
  children,
  language,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { language: hbl } = useConfig();
  const text = getNodeText(children);
  const languages = ["en"];
  if (language) {
    languages.push(language);
  }
  if (hbl) {
    languages.push(hbl);
  }
  const options = {
    style: "scratch3",
    languages: languages,
  };

  useEffect(() => {
    renderScratchblock(text, options).then((svg) => {
      if (ref.current) {
        ref.current.innerHTML = "";
        ref.current.appendChild(svg);
      }
    });
  }, [text]);

  return <div className="element-scratchblock" ref={ref} />;
};

export default {
  directives: { scratchblock: DirectiveScratchblock },
};
