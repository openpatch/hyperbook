import { GetStaticProps } from "next";
import { Shell } from "@hyperbook/shell";
import { Glossary as TGlossary } from "@hyperbook/types";
import { useActivePageId, useLink } from "@hyperbook/provider";
import { ShellProps } from "@hyperbook/shell";
import { hyperbook, vfile } from "@hyperbook/fs";
import { useScrollHash } from "../../useScrollHash";

export type GlossaryProps = {
  navigation: ShellProps["navigation"];
  glossary: TGlossary;
};

export default function Glossary({ glossary, navigation }: GlossaryProps) {
  const Link = useLink();
  useActivePageId();
  useScrollHash();
  return (
    <Shell navigation={navigation}>
      <article className="glossary">
        {Object.keys(glossary).map((letter) => (
          <div key={letter} className="container">
            <div className="letter">{letter}</div>
            <ul className="terms">
              {glossary[letter].map((term) => (
                <li key={term.href}>
                  <Link className="term" href={term.href}>
                    {term.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </article>
    </Shell>
  );
}

export const getStaticProps: GetStaticProps<{
  glossary: GlossaryProps["glossary"];
}> = async () => {
  const root = process.env.root ?? process.cwd();

  const glossaryData = await vfile.getGlossary(root);
  const hyperbookJson = await hyperbook.getJson(root);
  const navigation = await hyperbook.getNavigation(root);

  return {
    props: {
      locale: hyperbookJson.language,
      glossary: glossaryData,
      navigation,
    },
  };
};
