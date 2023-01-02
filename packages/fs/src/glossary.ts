import { Glossary } from "@hyperbook/types";
import { getMarkdown, listForFolder, VFile } from "./vfile";

export const get = async (root: string): Promise<Glossary> => {
  const glossary: Glossary = {};
  const files = await listForFolder(root, "glossary");
  for (const file of files) {
    const { data } = await getMarkdown(file);
    let name = data.name;
    if (file.path.href === null) {
      continue;
    }

    if (!name) {
      name = file.name;
    }

    const letter = name[0].toUpperCase();
    if (!glossary[letter]) {
      glossary[letter] = [];
    }

    glossary[letter].push({
      name,
      href: file.path.href,
    });
  }
  return glossary;
};

export const getReferences = async (file: VFile): Promise<VFile[]> => {
  const bookFiles = await listForFolder(file.root, "book");
  const vfiles: VFile[] = [];
  for (const bookFile of bookFiles) {
    const { content, data } = await getMarkdown(bookFile);
    const r = new RegExp(
      `:t\\[.*\\]\\{#${file.name}(\..*)?\\}|:t\\[${file.name}\\]`
    );
    const m = content.match(r);
    if (m && !data.hide) {
      vfiles.push({ ...bookFile, name: data.name || bookFile.name });
    }
  }
  return vfiles;
};
