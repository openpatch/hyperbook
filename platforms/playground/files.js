/** @satisfies {import('@webcontainer/api').FileSystemTree} */

export const files = {
  'hyperbook.json': {
    file: {
      contents: `{
  "name": "My Hyperbook",
  "description": "An interactive documentation example",
  "language": "en",
  "basePath": "",
  "colors": {
    "brand": "#667eea"
  },
  "elements": {
    "bookmarks": true,
    "links": true,
    "pages": true
  }
}`,
    },
  },
  'package.json': {
    file: {
      contents: `{
  "name": "hyperbook-playground",
  "version": "1.0.0",
  "type": "module"
}`,
    },
  },
  'book': {
    directory: {
      'index.md': {
        file: {
          contents: `---
name: Getting Started
---

# Welcome to Hyperbook! 🚀

**Hyperbook** is a modern tool for creating interactive documentation and educational content.

## Features

- 📝 **Markdown-based** - Write content in simple Markdown
- 🎨 **Customizable** - Theme and style your book
- 🚀 **Fast** - Built with modern web technologies
- 📱 **Responsive** - Works on all devices

## Quick Start

\`\`\`bash
npx hyperbook new my-book
cd my-book
npx hyperbook dev
\`\`\`

## Custom Directives

:::alert{warn}
This is a warning alert!
:::

:::alert{info}
Hyperbook supports custom markdown directives for rich content.
:::

## Adding Images

Upload images using the 📤 Upload button in the file panel. 
They'll be automatically placed in \`book/images/\`.

Then reference them in your markdown:

\`\`\`markdown
![Image description](./images/your-image.png)
\`\`\`

## Code Examples

\`\`\`javascript
// Example code
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("Hyperbook"));
\`\`\`

---

*Happy documenting!* ✨`,
        },
      },
    },
  },
};
