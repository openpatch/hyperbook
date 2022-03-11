import fs from "fs";
import matter from "gray-matter";
import { GetStaticPaths, GetStaticProps } from "next";
import Link from "next/link";
import path from "path";
import { resetIdCounter } from "react-tabs";
import { Layout } from "../components/Layout";
import { Markdown } from "../components/Markdown";
import { getAllFiles } from "../utils/files";
import {
  Navigation as NavigationProps,
  getNavigation,
} from "../utils/navigation";

type PageProps = {
  markdown: string;
  navigation: NavigationProps;
};

export default function BookPage({ markdown, navigation }: PageProps) {
  const page = navigation.current;
  return (
    <Layout navigation={navigation} page={page}>
      <article>
        <Markdown children={markdown} />
      </article>
      <div className="jump-container">
        {navigation.previous ? (
          <Link href={navigation.previous.href}>
            <a className="jump previous">{navigation.previous.name}</a>
          </Link>
        ) : (
          <div className="flex" />
        )}
        {navigation.next ? (
          <Link href={navigation.next.href}>
            <a className="jump next">{navigation.next.name}</a>
          </Link>
        ) : (
          <div className="flex" />
        )}
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps<
  PageProps,
  {
    page: string[];
  }
> = async ({ params }) => {
  let source: Buffer;
  let filePath = path.join(process.cwd(), "book");
  let href = "/";
  if (params.page) {
    filePath = path.join(filePath, ...params.page);
    href = "/" + path.join(...params.page);
  }
  try {
    source = fs.readFileSync(filePath + ".md");
  } catch (e) {
    source = fs.readFileSync(path.join(filePath, "index") + ".md");
  }
  const { content } = matter(source);

  const navigation = await getNavigation(href);

  return {
    props: {
      markdown: content,
      navigation,
    },
  };
};

export const getStaticPaths: GetStaticPaths<{
  page: string[];
}> = async () => {
  const files = getAllFiles("book");
  const paths = files.map((f) => {
    const relativePath = path
      .relative("book", f)
      .replace(/\.mdx?$/, "")
      .split("/");
    const isIndex = relativePath[relativePath.length - 1] === "index";
    if (isIndex) {
      relativePath.pop();
    }
    return {
      params: {
        page: relativePath,
      },
    };
  });

  return {
    paths,
    fallback: false,
  };
};
