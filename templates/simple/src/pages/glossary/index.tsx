import { GetStaticProps } from "next";
import fs from "fs";
import { getAllFiles } from "../../utils/files";
import matter from "gray-matter";
import chalk from "chalk";
import { Layout } from "../../components/Layout";
import { getNavigation, Navigation } from "../../utils/navigation";
import Link from "next/link";
import { usePage } from "../../store";
import path from "path";

export type Term = {
  name: string;
  href: string;
};

export type GlossaryProps = {
  navigation: Navigation;
  terms: Record<string, Term[]>;
};

export default function Glossary({ terms, navigation }: GlossaryProps) {
  usePage();
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
                <Link href={term.href} key={term.href}>
                  <a className="term">
                    <li>{term.name}</li>
                  </a>
                </Link>
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

  return { props: { terms, navigation } };
};
