// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { registerDirective } from "./remarkHelper";
import { ElementContent } from "hast";
import hash from "./objectHash";
import { i18n } from "./i18n";
import { unified } from "unified";
import { Node } from "unified/lib";
import { ContainerDirective, LeafDirective } from "mdast-util-directive";
import rehypeStringify from "rehype-stringify";
import rehypeKatex from "rehype-katex";
import remarkRehype from "remark-rehype";
import remarkMath from "remark-math";
import remarkParse from "./remarkParse";

const createPlayerControls = (
  node: ContainerDirective | LeafDirective,
  ctx: HyperbookContext,
): void => {
  const data = node.data || (node.data = {});
  const {
    src,
    thumbnail,
    title,
    author,
    position = "left",
  } = node.data.hProperties || {};
  const id = hash(node);

  node.attributes = {};
  data.hName = "div";
  data.hProperties = {
    class: "directive-audio",
  };
  const playerChildren: ElementContent[] = [];
  if (position === "left") {
    if (thumbnail && typeof thumbnail === "string") {
      playerChildren.push({
        type: "element",
        tagName: "div",
        properties: {
          class: "thumbnail",
          style: `background-image: url("${ctx.makeUrl(
            thumbnail,
            "public",
            ctx.navigation.current || undefined,
          )}")`,
        },
        children: [],
      });
    }
    playerChildren.push({
      type: "element",
      tagName: "button",
      properties: {
        class: "play",
        onclick: `hyperbook.audio.togglePlayPause("${id}")`,
        title: i18n.get("audio-play"),
      },
      children: [],
    });
  }
  playerChildren.push({
    type: "element",
    tagName: "div",
    properties: {
      class: "wave",
      id,
      "data-src": ctx.makeUrl(
        (src as string) || "",
        "public",
        ctx.navigation.current || undefined,
      ),
    },
    children: [],
  });

  if (position === "right") {
    playerChildren.push({
      type: "element",
      tagName: "button",
      properties: {
        class: "play",
        onclick: `hyperbook.audio.togglePlayPause("${id}")`,
        title: i18n.get("audio-play"),
      },
      children: [],
    });
    if (thumbnail && typeof thumbnail === "string") {
      playerChildren.push({
        type: "element",
        tagName: "div",
        properties: {
          class: "thumbnail",
          style: `background-image: url("${ctx.makeUrl(
            thumbnail,
            "public",
            ctx.navigation.current || undefined,
          )}")`,
        },
        children: [],
      });
    }
  }

  const informationChildren: ElementContent[] = [];
  if (title) {
    informationChildren.push({
      type: "element",
      tagName: "span",
      properties: {
        class: "title",
      },
      children: [
        {
          type: "text",
          value: title as string,
        },
      ],
    });
  }
  if (title && author) {
    informationChildren.push({
      type: "element",
      tagName: "span",
      properties: {
        class: "spacer",
      },
      children: [
        {
          type: "text",
          value: " - ",
        },
      ],
    });
  }
  if (author) {
    informationChildren.push({
      type: "element",
      tagName: "span",
      properties: {
        class: "author",
      },
      children: [
        {
          type: "text",
          value: author as string,
        },
      ],
    });
  }
  informationChildren.push({
    type: "element",
    tagName: "span",
    properties: {
      class: "duration",
    },
    children: [
      {
        type: "text",
        value: "",
      },
    ],
  });

  data.hChildren = [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "head",
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "player",
          },
          children: playerChildren,
        },
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "information",
          },
          children: informationChildren,
        },
      ],
    },
  ];
};

/**
 * Extract raw markdown content from the original source
 * This allows us to find HTML comments that might be stripped by remark
 */
function getRawMarkdownContent(node: Node, file: VFile): string {
  const start = node.position.start.offset;
  const end = node.position.end.offset;
  return file.value.slice(start, end) as string;
}

/**
 * Extract text for speech (visible text + content from HTML comments)
 */
function extractSpeechText(rawContent: string) {
  let speechText = "";

  // Process the content line by line to handle comments and visible text
  const lines = rawContent.split("\n");

  for (let line of lines) {
    // Extract HTML comments and their content
    const commentRegex = /<!--\s*(.*?)\s*-->/g;
    let match;

    while ((match = commentRegex.exec(line)) !== null) {
      const commentContent = match[1].trim();
      if (commentContent) {
        speechText += " " + commentContent;
      }
    }

    // Remove comments from line and process visible content
    const lineWithoutComments = line.replace(/<!--.*?-->/g, "");

    // Extract visible text (skip math blocks, code blocks, etc.)
    const visibleText = extractVisibleTextFromLine(lineWithoutComments);
    if (visibleText.trim()) {
      speechText += " " + visibleText;
    }
  }

  return speechText.replace(/\s+/g, " ").trim();
}

/**
 * Extract display content (remove HTML comments, keep formatting)
 */
function extractDisplayContent(rawContent: string) {
  // Simply remove HTML comments but keep everything else
  return rawContent.replace(/<!--.*?-->/gs, "").trim();
}

/**
 * Extract visible text from a line (skip math, code, etc.)
 */
function extractVisibleTextFromLine(line: string) {
  // Skip math blocks
  if (line.match(/^\s*\$\$/)) {
    return "";
  }

  // Skip code blocks
  if (line.match(/^\s*```/)) {
    return "";
  }

  // Extract text from inline elements
  let text = line;

  // Remove inline math but keep surrounding text
  text = text.replace(/\$[^$]+\$/g, "");

  // Remove inline code but keep surrounding text
  text = text.replace(/`[^`]+`/g, "");

  // Remove markdown formatting but keep text content
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1"); // Bold
  text = text.replace(/\*([^*]+)\*/g, "$1"); // Italic
  text = text.replace(/`([^`]+)`/g, "$1"); // Code

  // Remove markdown headers, links, etc. but keep text
  text = text.replace(/^#+\s*/, ""); // Headers
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // Links

  return text.replace(/\s+/g, " ").trim();
}

/**
 * Process markdown to HTML
 */
async function processMarkdownToHTML(markdownContent: string) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatex)
    .use(rehypeStringify, { allowDangerousHtml: true });

  const result = await processor.process(markdownContent);
  return String(result);
}

const createReadAlong = async (
  node: ContainerDirective,
  file: VFile,
  ctx: HyperbookContext,
): Promise<void> => {
  const data = node.data || (node.data = {});
  const { src, language } = node.data.hProperties || {};

  let rawContent = getRawMarkdownContent(node, file);
  rawContent = rawContent.split("\n").slice(1, -1).join("\n");

  const speechText = extractSpeechText(rawContent);
  const displayContent = extractDisplayContent(rawContent);
  const displayHtml = await processMarkdownToHTML(displayContent);

  data.hChildren = [
    ...(data.hChildren || []),
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "read-along",
      },
      children: [
        {
          type: "raw",
          value: displayHtml,
        },
      ],
    },
  ];
};

export default (ctx: HyperbookContext) => () => {
  const name = "audio";
  return async (tree: Root, file: VFile) => {
    const audioLeafs: { node: LeafDirective; index: number; parent: Node }[] =
      [];
    const audioContainer: {
      node: ContainerDirective;
      index: number;
      parent: Node;
    }[] = [];

    visit(tree, "containerDirective", function (node, index, parent) {
      if (node.name === name) {
        audioContainer.push({ node, index, parent });
      }
    });
    visit(tree, "leafDirective", function (node, index, parent) {
      if (node.name === name) {
        audioLeafs.push({ node, index, parent });
      }
    });

    if (audioLeafs.length > 0 || audioContainer.length > 0) {
      registerDirective(
        file,
        name,
        ["wavesurfer.min.js", "client.js"],
        ["style.css"],
        [],
      );
    }

    // Process audio leafs
    for (const { node } of audioLeafs) {
      createPlayerControls(node, ctx);
    }

    // Process audio container
    for (const { node } of audioContainer) {
      createPlayerControls(node, ctx);
      await createReadAlong(node, file, ctx);
    }
  };
};
