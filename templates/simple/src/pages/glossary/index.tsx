import { GetStaticProps } from "next";
import fs from "fs";
import { getAllFiles } from "../../utils/files";
import matter from "gray-matter";
import chalk from "chalk";
import { Layout } from "../../components/Layout";
import { getNavigation, Navigation } from "../../utils/navigation";
import path from "path";
import { getHyperbook } from "../../utils/hyperbook";
import { useActivePageId, useLink } from "@hyperbook/provider";

export type Term = {
  name: string;
  href: string;
};

export type GlossaryProps = {
  navigation: Navigation;
  terms: Record<string, Term[]>;
};

const hyperbook = getHyperbook();

export default function Glossary({ terms, navigation }: GlossaryProps) {
  const Link = useLink();
  useActivePageId();
  return (
    <Layout
      navigation={navigation}
      page={{
        name: "Glossary",
      }}
    >
      <article className="glossary">
        {Object.keys(terms).map((letter) => (
          <div key={letter} className="container">
            <div className="letter">{letter}</div>
            <ul className="terms">
              {terms[letter].map((term) => (
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
    </Layout>
  );
}

export const getStaticProps: GetStaticProps<{
  terms: GlossaryProps["terms"];
}> = async () => {
  const files = getAllFiles("glossary");

  const terms: GlossaryProps["terms"] = {};
  for (const file of files) {
    const source = fs.readFileSync(file);
    const { data } = matter(source);

    let name = path.basename(file, ".md");
    if (data.name) {
      name = data.name;
    } else {
      console.log(
        `\n${chalk.yellow(
          `warn  `
        )}- Glossary page ${file} does not specify a name. Defaulting to the filename ${name}.`
      );
    }
    const letter = name[0].toUpperCase();
    if (!terms[letter]) {
      terms[letter] = [];
    }

    terms[letter].push({
      name,
      href: file.replace(/\.mdx?$/, ""),
    });
  }

  const navigation = await getNavigation();

  return {
    props: {
      locale: hyperbook.language,
      terms,
      navigation,
    },
  };
};
