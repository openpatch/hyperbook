/*
 * What a new book starts with when a teacher creates it in the editor
 * instead of uploading a zip.
 */

export type TemplateName = "default" | "empty";

const gitignore = ".hyperbook/\nnode_modules/\n";

function hyperbookJson(title: string) {
  return JSON.stringify({ name: title, language: "en" }, null, 2) + "\n";
}

export function bookTemplate(name: TemplateName, title: string): Record<string, string> {
  if (name === "empty") {
    return {
      ".gitignore": gitignore,
      "hyperbook.json": hyperbookJson(title),
      "book/index.md": `---\nname: ${JSON.stringify(title)}\n---\n\n# ${title}\n`,
    };
  }
  return {
    ".gitignore": gitignore,
    "hyperbook.json": hyperbookJson(title),
    "book/index.md": `---
name: Welcome
---

# ${title}

This book was made with :t[Hyperbook]{#hyperbook}. Every page is a Markdown file in the
\`book\` folder; this one is \`book/index.md\`.

:::alert{info}
Change this page, save it, and look at the preview beside the editor.
Students see your changes once you publish them.
:::

Continue with the [first steps](/first-steps).
`,
    "book/first-steps.md": `---
name: First steps
---

# First steps

## Text

Write **bold**, _italic_ and \`code\`, lists and [links](https://hyperbook.openpatch.org).

- one
- two

## Tasks

:::collapsible{title="Show the solution"}
Collapsibles hide what students should find out themselves first.
:::

::::tabs

:::tab{title="Python"}
\`\`\`python
print("Hello")
\`\`\`
:::

:::tab{title="Java"}
\`\`\`java
System.out.println("Hello");
\`\`\`
:::

::::

## More

Hyperbook has many more elements: quizzes, code editors, learning maps,
drawings. The [documentation](https://hyperbook.openpatch.org) lists them all.
`,
    "glossary/hyperbook.md": `---
name: Hyperbook
---

Hyperbook turns Markdown files into an interactive book for the web.
`,
  };
}
