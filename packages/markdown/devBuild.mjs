import fs from "fs/promises";
import path from "path";
import { process } from "./dist/index.js";

const markdown = await fs.readFile("dev.md", "utf8");

const result = await process(markdown, {
  root: "",
  config: {
    name: "Hyperbook Dokumenation",
    description: "Dokumentation für Hyperbook erstellt mit Hyperbook",
    qrcode: true,
    search: true,
    author: {
      name: "OpenPatch",
      url: "https://openpatch.org",
    },
    links: [
      {
        label: "Kontakt",
        icon: "🐦",
        links: [
          {
            label: "Mail",
            href: "mailto:contact@openpatch.org",
          },
          {
            label: "Twitter",
            icon: "🐦",
            href: "https://twitter.com/openpatchorg",
          },
          {
            label: "Mastodon",
            icon: "🐘",
            href: "https://fosstodon.org/@openpatch",
          },
          {
            label: "Matrix (Chat)",
            icon: "👨‍💻",
            href: "https://matrix.to/#/#hyperbook:matrix.org",
          },
        ],
      },
      {
        label: "Kontakt 2",
        icon: "🐦",
      },
    ],
    repo: "https://github.com/openpatch/hyperbook/edit/main/website/de",
    elements: {
      code: {
        bypassInline: false,
      },
    },
  },
  makeUrl: (p, base) => {
    if (p.includes("://")) return p;
    if (typeof p === "string") {
      p = [p];
    }
    if (base === "public") {
      return path.posix.join("/public", ...p);
    } else if (base === "book") {
      return path.posix.join("/", ...p);
    }
    if (base === "assets") {
      return path.posix.join("/dist", base, ...p);
    }
    return path.posix.join("", base, ...p);
  },

  navigation: {
    next: {
      name: "Bild",
      lang: "de",
      repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/image.md",
      href: "/markdown/image",
    },
    current: {
      name: "Markdown Referenz",
      permaid: "md",
      index: 0,
      isEmpty: true,
      pages: [
        {
          name: "Bild",
          lang: "de",
          repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/image.md",
          href: "/markdown/image",
        },
        {
          name: "Hervorhebung",
          lang: "de",
          repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/emphasis.md",
          href: "/markdown/emphasis",
        },
        {
          name: "Horizontale Linie",
          lang: "de",
          repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/hr.md",
          href: "/markdown/hr",
        },
        {
          name: "Kommentar",
          lang: "de",
          repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/comment.md",
          href: "/markdown/comment",
        },
        {
          name: "Link",
          lang: "de",
          repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/link.md",
          href: "/markdown/link",
        },
        {
          name: "Liste",
          lang: "de",
          repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/list.md",
          href: "/markdown/list",
        },
        {
          name: "Quelltext",
          lang: "de",
          repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/code.md",
          href: "/markdown/code",
        },
        {
          name: "Tabelle",
          lang: "de",
          repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/table.md",
          href: "/markdown/table",
        },
        {
          name: "Zeilenumbruch",
          lang: "de",
          repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/line-break.md",
          href: "/markdown/line-break",
        },
        {
          name: "Zitat",
          lang: "de",
          repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/quote.md",
          href: "/markdown/quote",
        },
        {
          name: "Überschriften",
          lang: "de",
          repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/header.md",
          href: "/markdown/header",
        },
      ],
      sections: [],
      repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/index.md",
      href: "/markdown",
    },
    previous: {
      name: "Bibliothek Konfiguration",
      lang: "de",
      repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/configuration/library.md",
      href: "/configuration/library",
    },
    sections: [
      {
        name: "Konfiguration",
        index: 0,
        isEmpty: true,
        pages: [
          {
            name: "Buch Konfiguration",
            index: 0,
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/configuration/book.md",
            href: "/configuration/book",
          },
          {
            name: "Seiten Konfiguration",
            lang: "de",
            index: 1,
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/configuration/page.md",
            href: "/configuration/page",
          },
          {
            name: "Bereich Konfiguration",
            index: 2,
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/configuration/section.md",
            href: "/configuration/section",
          },
          {
            name: "Bibliothek Konfiguration",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/configuration/library.md",
            href: "/configuration/library",
          },
        ],
        sections: [],
        repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/configuration/index.md",
        href: "/configuration",
      },
      {
        name: "Markdown Referenz",
        index: 0,
        isEmpty: true,
        pages: [
          {
            name: "Bild",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/image.md",
            href: "/markdown/image",
          },
          {
            name: "Hervorhebung",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/emphasis.md",
            href: "/markdown/emphasis",
          },
          {
            name: "Horizontale Linie",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/hr.md",
            href: "/markdown/hr",
          },
          {
            name: "Kommentar",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/comment.md",
            href: "/markdown/comment",
          },
          {
            name: "Link",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/link.md",
            href: "/markdown/link",
          },
          {
            name: "Liste",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/list.md",
            href: "/markdown/list",
          },
          {
            name: "Quelltext",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/code.md",
            href: "/markdown/code",
          },
          {
            name: "Tabelle",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/table.md",
            href: "/markdown/table",
          },
          {
            name: "Zeilenumbruch",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/line-break.md",
            href: "/markdown/line-break",
          },
          {
            name: "Zitat",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/quote.md",
            href: "/markdown/quote",
          },
          {
            name: "Überschriften",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/header.md",
            href: "/markdown/header",
          },
        ],
        sections: [],
        repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/markdown/index.md",
        href: "/markdown",
      },
      {
        name: "Elemente",
        index: 1,
        isEmpty: true,
        pages: [
          {
            name: "Archiv",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/archive.md",
            href: "/elements/archive",
          },
          {
            name: "Audio",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/audio.md",
            href: "/elements/audio",
          },
          {
            name: "Bitflow",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/bitflow.md",
            href: "/elements/bitflow",
          },
          {
            name: "Download",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/download.md",
            href: "/elements/download",
          },
          {
            name: "Embed",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/embed.md",
            href: "/elements/embed",
          },
          {
            name: "Emoji",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/emoji.md",
            href: "/elements/emoji",
          },
          {
            name: "Excalidraw",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/excalidraw.md",
            href: "/elements/excalidraw",
          },
          {
            name: "Geschützer Bereich",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/protect.md",
            href: "/elements/protect",
          },
          {
            name: "Glossar",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/glossary.md",
            href: "/elements/glossary",
          },
          {
            name: "Hinweise",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/alert.md",
            href: "/elements/alert",
          },
          {
            name: "Kacheln",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/tiles.md",
            href: "/elements/tiles",
          },
          {
            name: "Klappkasten",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/collapsible.md",
            href: "/elements/collapsible",
          },
          {
            name: "Lesezeichen",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/bookmarks.md",
            href: "/elements/bookmarks",
          },
          {
            name: "Mathmathik",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/math.md",
            href: "/elements/math",
          },
          {
            name: "Mermaid",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/mermaid.md",
            href: "/elements/mermaid",
          },
          {
            name: "Online IDE",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/online-ide.md",
            href: "/elements/online-ide",
          },
          {
            name: "PlantUML",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/plantuml.md",
            href: "/elements/plantuml",
          },
          {
            name: "QR Code",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/qr.md",
            href: "/elements/qr",
          },
          {
            name: "Reiter",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/tabs.md",
            href: "/elements/tabs",
          },
          {
            name: "SQL IDE",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/sql-ide.md",
            href: "/elements/sql-ide",
          },
          {
            name: "Scratchblöcke",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/scratchblock.md",
            href: "/elements/scratchblock",
          },
          {
            name: "Slideshow",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/slideshow.md",
            href: "/elements/slideshow",
          },
          {
            name: "Snippets",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/snippets.md",
            href: "/elements/snippets",
          },
          {
            name: "Struktog",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/struktog.md",
            href: "/elements/struktog",
          },
          {
            name: "Video",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/video.md",
            href: "/elements/video",
          },
          {
            name: "YouTube",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/youtube.md",
            href: "/elements/youtube",
          },
        ],
        sections: [],
        repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/elements/index.md",
        href: "/elements",
      },
      {
        name: "Fortgeschrittene Features",
        index: 10,
        isEmpty: true,
        pages: [
          {
            name: "Einweg Vorlagen",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/advanced/single-use-templates.md.hbs",
            href: "/advanced/single-use-templates",
          },
          {
            name: "Vorlage - Demo",
            hide: true,
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/advanced/template-demo-json.json",
            href: "/advanced/template-demo-json",
          },
          {
            name: "Vorlagen",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/advanced/templates.md",
            href: "/advanced/templates",
          },
          {
            name: "Vorlagen - Demo",
            hide: true,
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/advanced/template-demo-yaml.yml",
            href: "/advanced/template-demo-yaml",
          },
        ],
        sections: [],
        repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/advanced/index.md",
        href: "/advanced",
      },
      {
        name: "Hosting",
        isEmpty: true,
        pages: [
          {
            name: "EduGit Pages",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/hosting/edugitpages.md",
            href: "/hosting/edugitpages",
          },
          {
            name: "Eigene Lösung",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/hosting/custom.md",
            href: "/hosting/custom",
          },
          {
            name: "GitHub Pages",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/hosting/ghpages.md",
            href: "/hosting/ghpages",
          },
          {
            name: "GitLab Pages",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/hosting/glpages.md",
            href: "/hosting/glpages",
          },
          {
            name: "Vercel",
            lang: "de",
            repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/hosting/vercel.md",
            href: "/hosting/vercel",
          },
        ],
        sections: [],
        repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/hosting/index.md",
        href: "/hosting",
      },
    ],
    glossary: [],
    pages: [
      {
        name: "Los Gehts",
        index: 0,
        lang: "de",
        repo: "https://github.com/openpatch/hyperbook/edit/main/website/de/book/index.md",
        href: "/",
      },
    ],
  },
});

await fs.writeFile("./index.html", result.value);
