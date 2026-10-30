/*
 * The directives a page can use, for completion, hover help and checks in
 * the Markdown editor. Taken from the element documentation
 * (website/en/book/elements); keep them in step when an element changes.
 */

export const DOCS = "https://hyperbook.openpatch.org";

/** `:name[]` in a line, `::name` on a line of its own, `:::name … :::` around content. */
export type DirectiveKind = "text" | "leaf" | "container";

export type Attribute = {
  name: string;
  description: string;
  /** Values offered after `name="`. */
  values?: readonly string[];
  /** The value names a file of the book, e.g. `src`. */
  file?: boolean;
  /** Written without a value, like `{export}`. */
  flag?: boolean;
};

export type Directive = {
  name: string;
  label: string;
  description: string;
  kind: DirectiveKind;
  /** Path of the documentation page under DOCS. */
  docs: string;
  attributes: readonly Attribute[];
  /**
   * What completion inserts after the colons (one for text, two for leaf,
   * three for container directives), in CodeMirror snippet syntax. A leading
   * `:` adds a colon, for containers that hold containers.
   */
  snippet: string;
  /** Only used inside these directives. */
  parents?: readonly string[];
  /** Other names for the same directive. */
  aliases?: readonly string[];
};

const id = (description = "Where the reader's state is saved; pin it to keep it when you edit the element"): Attribute => ({ name: "id", description });
const height = (fallback: string): Attribute => ({ name: "height", description: `Height, e.g. \`600px\` (default \`${fallback}\`)` });
const files = (fallback: string): Attribute => ({
  name: "files",
  description: `What readers may do with files: \`create\`, \`upload\`, \`rename\`, \`delete\`, comma-separated, or \`open\` for all (default ${fallback})`,
  values: ["open", "create", "upload", "create,upload", "create,upload,rename,delete"],
});
const accept = (fallback: string): Attribute => ({ name: "accept", description: `Extensions of files readers create or rename (default \`${fallback}\`)` });
const BOOL = ["true", "false"] as const;
const SIZES = ["S", "M", "L"] as const;

export const DIRECTIVES: readonly Directive[] = [
  {
    name: "alert",
    label: "Alert",
    description: "A highlighted box that draws the reader's attention.",
    kind: "container",
    docs: "/elements/alert",
    attributes: [
      { name: "info", description: "Blue info box", flag: true },
      { name: "success", description: "Green success box", flag: true },
      { name: "warn", description: "Yellow warning box", flag: true },
      { name: "error", description: "Red error box", flag: true },
      { name: "color", description: "A color of your own, e.g. `#ff8800`" },
      { name: "label", description: "Label or emoji shown as the icon" },
    ],
    snippet: "alert{${info}}\n${Text}\n:::",
  },
  {
    name: "collapsible",
    label: "Collapsible",
    description: "Content the reader opens with a click, e.g. a hint or a solution.",
    kind: "container",
    docs: "/elements/collapsible",
    attributes: [
      { name: "title", description: "Title shown in the summary" },
      id("Shared id; collapsibles with the same id open and close together"),
    ],
    snippet: 'collapsible{title="${Hint}"}\n${Text}\n:::',
  },
  {
    name: "tabs",
    label: "Tabs",
    description: "Alternative content in tabs. Put `:::tab` blocks inside and use four colons for `::::tabs`.",
    kind: "container",
    docs: "/elements/tabs",
    attributes: [id("Shared id; tab groups with the same id switch together")],
    snippet: ':tabs\n:::tab{title="${First}"}\n${Text}\n:::\n:::tab{title="${Second}"}\n${Text}\n:::\n::::',
  },
  {
    name: "tab",
    label: "Tab",
    description: "One tab inside `::::tabs`.",
    kind: "container",
    docs: "/elements/tabs",
    parents: ["tabs"],
    attributes: [
      { name: "title", description: "Label in the tab bar" },
      id("Id for syncing tabs across groups"),
    ],
    snippet: 'tab{title="${Title}"}\n${Text}\n:::',
  },
  {
    name: "tiles",
    label: "Tiles",
    description: "A grid of tiles, e.g. links to chapters. Put `::tile` inside.",
    kind: "container",
    docs: "/elements/tiles",
    attributes: [],
    snippet: 'tiles\n::tile{title="${Title}" href="${/page}"}\n:::',
  },
  {
    name: "tile",
    label: "Tile",
    description: "One tile inside `:::tiles`.",
    kind: "leaf",
    docs: "/elements/tiles",
    parents: ["tiles"],
    attributes: [
      { name: "title", description: "Title in the tile" },
      { name: "href", description: "Page or address the tile links to" },
      { name: "size", description: "Size of the tile (default `M`)", values: SIZES },
      { name: "icon", description: "Icon address or emoji such as `:rocket:`" },
    ],
    snippet: 'tile{title="${Title}" href="${/page}"}',
  },
  {
    name: "protect",
    label: "Protect",
    description: "Content that only opens with a password, e.g. solutions.",
    kind: "container",
    docs: "/elements/protect",
    attributes: [
      { name: "password", description: "The password readers type" },
      { name: "use", description: "Key of a password in passwords.json" },
      { name: "name", description: "Label in a password list" },
      { name: "description", description: "Shown above the password field" },
      id("Shared id; protected blocks with the same id unlock together"),
      { name: "mode", description: "`encrypt` (default) or `obfuscate`", values: ["encrypt", "obfuscate"] },
      { name: "iterations", description: "PBKDF2 iterations (default 250000)" },
      { name: "passwordsFile", description: "Location of the password registry", file: true },
    ],
    snippet: 'protect{password="${password}" description="${Ask your teacher}"}\n${Solution}\n:::',
  },
  {
    name: "textinput",
    label: "Text input",
    description: "A text field whose answer is kept in the reader's browser.",
    kind: "leaf",
    docs: "/elements/textinput",
    attributes: [
      id("Where the answer is saved"),
      { name: "placeholder", description: "Text shown while the field is empty" },
      height("200px"),
    ],
    snippet: 'textinput{placeholder="${Your answer}"}',
  },
  {
    name: "multievent",
    label: "Multievent",
    description: "Gap texts, multiple choice and other exercises written with `{{…}}`.",
    kind: "container",
    docs: "/elements/multievent",
    attributes: [],
    snippet: "multievent\nThe capital of France is {{Paris}}.${}\n:::",
  },
  {
    name: "video",
    label: "Video",
    description: "A video player.",
    kind: "leaf",
    docs: "/elements/video",
    attributes: [
      { name: "src", description: "Video file or address", file: true },
      { name: "title", description: "Title below the player" },
      { name: "author", description: "Author below the player" },
      { name: "poster", description: "Image shown before playback", file: true },
    ],
    snippet: 'video{src="${/video.mp4}" title="${Title}"}',
  },
  {
    name: "audio",
    label: "Audio",
    description: "An audio player.",
    kind: "leaf",
    docs: "/elements/audio",
    attributes: [
      { name: "src", description: "Audio file or address", file: true },
      { name: "thumbnail", description: "Thumbnail image", file: true },
      { name: "title", description: "Title below the player" },
      { name: "author", description: "Author below the player" },
      { name: "position", description: "Side of the play button (default `left`)", values: ["left", "right"] },
    ],
    snippet: 'audio{src="${/audio.mp3}" title="${Title}"}',
  },
  {
    name: "youtube",
    label: "YouTube",
    description: "A YouTube video; the text in [] is its title, `#…` its id.",
    kind: "leaf",
    docs: "/elements/youtube",
    attributes: [],
    snippet: "youtube[${Title}]{#${videoId}}",
  },
  {
    name: "embed",
    label: "Embed",
    description: "Another web page in a frame.",
    kind: "leaf",
    docs: "/elements/embed",
    attributes: [
      { name: "src", description: "Address to embed" },
      { name: "aspectRatio", description: "e.g. `16/9`", values: ["16/9", "4/3", "1/1"] },
      height("400px"),
      { name: "width", description: "Width (default `100%`)" },
      { name: "allowFullscreen", description: "Allow fullscreen (default `true`)", values: BOOL },
    ],
    snippet: 'embed{src="${https://}" aspectRatio="16/9"}',
  },
  {
    name: "download",
    label: "Download",
    description: "A download button for a file.",
    kind: "text",
    docs: "/elements/download",
    attributes: [{ name: "src", description: "File to download", file: true }],
    snippet: 'download[${Download}]{src="${/file.pdf}"}',
  },
  {
    name: "archive",
    label: "Archive",
    description: "A download of a folder in archives/ as a zip.",
    kind: "text",
    docs: "/elements/archive",
    attributes: [{ name: "name", description: "Folder inside archives/" }],
    snippet: 'archive[${Download project}]{name="${project}"}',
  },
  {
    name: "term",
    label: "Glossary term",
    description: "A word linked to its glossary entry; `#…` is the entry's file name.",
    kind: "text",
    docs: "/elements/glossary",
    aliases: ["t"],
    attributes: [],
    snippet: "t[${word}]{#${entry}}",
  },
  {
    name: "qr",
    label: "QR code",
    description: "A QR code, e.g. for a link students open on their phones.",
    kind: "leaf",
    docs: "/elements/qr",
    attributes: [
      { name: "value", description: "What the code encodes" },
      { name: "size", description: "Size (default `M`)", values: ["S", "M", "L", "XL"] },
      { name: "label", description: "Label below the code" },
    ],
    snippet: 'qr{value="${https://}" size="M"}',
  },
  {
    name: "pagelist",
    label: "Page list",
    description: "A list of pages, chosen by a query.",
    kind: "leaf",
    docs: "/elements/pagelist",
    attributes: [
      { name: "format", description: "`ul`, `ol`, `glossary` or `#snippet`", values: ["ul", "ol", "glossary"] },
      { name: "source", description: "Which pages, e.g. `href(/chapter/.*)`" },
      { name: "orderBy", description: "e.g. `name:asc`", values: ["name:asc", "name:desc", "index:asc", "index:desc"] },
      { name: "limit", description: "At most this many pages" },
    ],
    snippet: 'pagelist{source="${href(/.*)}"}',
  },
  {
    name: "bookmarks",
    label: "Bookmarks",
    description: "The pages the reader bookmarked.",
    kind: "leaf",
    docs: "/elements/bookmarks",
    attributes: [],
    snippet: "bookmarks",
  },
  {
    name: "passwordlist",
    label: "Password list",
    description: "The passwords of the book, for the teacher's page.",
    kind: "leaf",
    docs: "/elements/passwordlist",
    attributes: [
      { name: "scope", description: "`all`, `section` or `page`", values: ["all", "section", "page"] },
      { name: "type", description: "Kinds of entry, comma-separated", values: ["registry", "section", "page", "block"] },
      { name: "source", description: "A query like in pagelist" },
      { name: "format", description: "`table`, `ul`, `ol` or `#snippet`", values: ["table", "ul", "ol"] },
      { name: "orderBy", description: "e.g. `key:asc`" },
      { name: "limit", description: "At most this many" },
      { name: "groupBy", description: "Comma-separated grouping levels", values: ["section", "top-section", "page", "type"] },
      { name: "collapsible", description: "Collapse groups for this many levels", values: ["1", "2", "all"] },
      { name: "showCount", description: "Number of entries in every group title", flag: true },
      { name: "columns", description: "`context`, `password`, `where`, `description`, comma-separated" },
    ],
    snippet: "passwordlist",
  },
  {
    name: "snippet",
    label: "Snippet",
    description: "Reuses a snippet from snippets/; `#…` is its file name.",
    kind: "leaf",
    docs: "/elements/snippets",
    attributes: [],
    snippet: "snippet{#${name}}",
  },
  {
    name: "slideshow",
    label: "Slideshow",
    description: "Images inside become a slideshow.",
    kind: "container",
    docs: "/elements/slideshow",
    attributes: [height("300px")],
    snippet: 'slideshow\n![${Caption}](${/image.jpg} "${Caption}")\n:::',
  },
  {
    name: "excalidraw",
    label: "Drawing",
    description: "An Excalidraw drawing.",
    kind: "leaf",
    docs: "/elements/excalidraw",
    attributes: [
      { name: "src", description: "The .excalidraw file", file: true },
      { name: "aspectRatio", description: "e.g. `16/9`", values: ["16/9", "4/3", "1/1"] },
      { name: "autoZoom", description: "Zoom to fit small screens (default `true`)", values: BOOL },
      { name: "edit", description: "Readers may draw (default `false`)", values: BOOL },
    ],
    snippet: 'excalidraw{src="${drawing.excalidraw}"}',
  },
  {
    name: "learningmap",
    label: "Learning map",
    description: "A map of topics readers work through.",
    kind: "leaf",
    docs: "/elements/learningmap",
    attributes: [{ name: "src", description: "The .learningmap file", file: true }, id(), height("calc(100vh - 80px)")],
    snippet: 'learningmap{src="${map.learningmap}" height="600px"}',
  },
  {
    name: "bitflow",
    label: "Flow",
    description: "A flow of steps and questions (assessment).",
    kind: "leaf",
    docs: "/elements/bitflow",
    attributes: [
      { name: "src", description: "The .bitflow file", file: true },
      id(),
      height("600px"),
      { name: "maxHeight", description: "The most the flow grows to, e.g. `80vh`" },
      { name: "locale", description: "Interface language (default: the book's)" },
      { name: "readonly", description: "Show without accepting answers", flag: true },
    ],
    snippet: 'bitflow{src="${flow.bitflow}" height="600px"}',
  },
  {
    name: "jmp",
    label: "Java memory diagram",
    description: "A Java Memory Playground of stack and heap.",
    kind: "leaf",
    docs: "/elements/jmp",
    attributes: [
      { name: "src", description: "The .jmp file", file: true },
      id(),
      height("600px"),
      { name: "step", description: "The step shown first, zero based" },
      { name: "language", description: "Interface language", values: ["en", "de"] },
      ...["hide-sidebar", "hide-call-method", "hide-declare-global-variable", "hide-new-array", "disable-garbage-collector", "create-new-on-edge-drop", "hide-steps", "hide-step-changes", "gc-prediction"].map(
        (name): Attribute => ({ name, description: name.replaceAll("-", " "), flag: true }),
      ),
    ],
    snippet: 'jmp{src="${memory.jmp}" height="600px"}',
  },
  {
    name: "struktolab",
    label: "Structogram",
    description: "A structogram (Nassi-Shneiderman diagram) from pseudocode or a .struktolab file.",
    kind: "container",
    docs: "/elements/struktolab",
    attributes: [
      { name: "mode", description: "`preview` (default) or `edit`", values: ["preview", "edit"] },
      { name: "scale", description: "Scale factor (default 1)" },
      { name: "fontSize", description: "Font size (default 14)" },
      { name: "lang", description: "Interface language", values: ["de", "en"] },
      { name: "colorMode", description: "Colors (default `color`)", values: ["color", "greyscale", "bw"] },
      { name: "src", description: "A .struktolab file instead of code", file: true },
    ],
    snippet: "struktolab\n```\n${x = 0}\n```\n:::",
  },
  {
    name: "struktog",
    label: "Struktog (deprecated)",
    description: "Old structogram editor; use struktolab instead.",
    kind: "leaf",
    docs: "/elements/struktog",
    attributes: [{ name: "data", description: "Struktog state or URL" }],
    snippet: 'struktog{data="${}"}',
  },
  {
    name: "pyide",
    label: "Python IDE",
    description: "Python that readers edit and run in the browser.",
    kind: "container",
    docs: "/elements/pyide",
    attributes: [
      { name: "packages", description: "PyPI packages to install, comma-separated" },
      { name: "canvas", description: "Show a canvas for turtle or pygame", flag: true },
      { name: "main", description: "The file that runs (default `main.py`)" },
      id(),
      files("none"),
      accept(".py"),
    ],
    snippet: "pyide\n```python\n${print(\"Hello\")}\n```\n:::",
  },
  {
    name: "webide",
    label: "Web IDE",
    description: "HTML, CSS and JavaScript that readers edit with a live preview.",
    kind: "container",
    docs: "/elements/webide",
    attributes: [height("calc(100dvh - 80px)"), { name: "main", description: "The page shown (default `index.html`)" }, id(), files("none"), accept(".html,.css,.js")],
    snippet: "webide\n```html index.html\n${<h1>Hello</h1>}\n```\n:::",
  },
  {
    name: "p5",
    label: "p5.js",
    description: "A p5.js sketch, shown or edited by readers.",
    kind: "container",
    docs: "/elements/p5",
    attributes: [
      height("calc(100dvh - 80px)"),
      { name: "mode", description: "`editor` shows the code next to the sketch", values: ["preview", "editor"] },
      id(),
      files("none"),
      accept(".js"),
      { name: "compare", description: "Compare with the solution's canvas" },
      { name: "pass", description: "Match in percent that counts as solved (default 98)" },
      { name: "frame", description: "Frame of an animation that is compared (default 1)" },
    ],
    snippet: 'p5{mode="editor"}\n```js\nfunction setup() {\n  createCanvas(400, 400);\n}\n\nfunction draw() {\n  ${background(220);}\n}\n```\n:::',
  },
  {
    name: "typst",
    label: "Typst",
    description: "A Typst document, previewed or edited by readers.",
    kind: "container",
    docs: "/elements/typst",
    attributes: [
      id(),
      { name: "mode", description: "`preview` (default) or `edit`", values: ["preview", "edit"] },
      height("auto"),
      { name: "main", description: "The file compiled (default `main.typ`)" },
      files("`create,upload`"),
      accept(".typ"),
    ],
    snippet: 'typst{mode="edit"}\n```typ main.typ\n${= Hello}\n```\n:::',
  },
  {
    name: "openscad",
    label: "OpenSCAD",
    description: "A 3D model in OpenSCAD that readers edit and render.",
    kind: "container",
    docs: "/elements/openscad",
    attributes: [
      id(),
      { name: "main", description: "The file rendered (default `main.scad`)" },
      height("calc(100dvh - 80px)"),
      { name: "library", description: "Libraries to load, comma-separated" },
      files("`upload`"),
      accept(".scad"),
    ],
    snippet: "openscad\n```scad main.scad\n${cube(10);}\n```\n:::",
  },
  {
    name: "onlineide",
    label: "Online-IDE (Java)",
    description: "Java programs that readers edit and run.",
    kind: "container",
    docs: "/elements/online-ide",
    attributes: [
      { name: "fileList", description: "Show the file list (default `true`)", values: BOOL },
      { name: "pCode", description: "Show the PCode tab (default `false`)", values: BOOL },
      { name: "bottomPanel", description: "Show the bottom panel (default `true`)", values: BOOL },
      { name: "errorList", description: "Show the error list (default `true`)", values: BOOL },
      height("calc(100dvh - 80px)"),
      { name: "speed", description: "Execution speed (default 1000)" },
      { name: "libraries", description: "Libraries to preload", values: ["nrw", "gng", "niedersachsen", "scratch", "zeichnen"] },
      { name: "outputWidth", description: "Width of the output panel, e.g. `60%`" },
    ],
    snippet: 'onlineide\n```java Main.java\n${System.out.println("Hello");}\n```\n:::',
  },
  {
    name: "sqlide",
    label: "SQL IDE",
    description: "SQL queries that readers run against a database.",
    kind: "container",
    docs: "/elements/sql-ide",
    attributes: [{ name: "db", description: "The SQLite database file", file: true }, height("calc(100dvh - 80px)")],
    snippet: "sqlide\n```mysql Statements.sql\n${SELECT * FROM table;}\n```\n:::",
  },
  {
    name: "file",
    label: "File",
    description: "A file of the book handed to an IDE (pyide, webide, p5, typst, openscad).",
    kind: "leaf",
    docs: "/elements/pyide",
    parents: ["pyide", "webide", "p5", "typst", "openscad"],
    attributes: [
      { name: "src", description: "The file in the book", file: true },
      { name: "dest", description: "Its name inside the IDE" },
    ],
    snippet: 'file{src="${/data.csv}" dest="${data.csv}"}',
  },
  {
    name: "geogebra",
    label: "GeoGebra",
    description: "A GeoGebra applet; commands inside are run on start.",
    kind: "container",
    docs: "/elements/geogebra",
    attributes: [
      { name: "perspective", description: "Visible views, e.g. `G` for geometry" },
      { name: "height", description: "Height in pixels (default 600)" },
      { name: "width", description: "Width in pixels (default 800)" },
      { name: "coordsystem", description: "Visible area as `xmin,xmax,ymin,ymax`" },
      { name: "src", description: "A .ggb file or applet address", file: true },
      { name: "appName", description: "Which GeoGebra app", values: ["graphing", "geometry", "3d", "classic", "suite", "evaluator", "scientific", "notes"] },
      { name: "showFullscreenButton", description: "Show the fullscreen button (default `true`)", values: BOOL },
      { name: "showResetIcon", description: "Show the reset icon (default `true`)", values: BOOL },
    ],
    snippet: 'geogebra{appName="${graphing}"}\n${f(x) = x^2}\n:::',
  },
  {
    name: "jsxgraph",
    label: "JSXGraph",
    description: "An interactive JSXGraph board; JavaScript inside draws on `board`.",
    kind: "container",
    docs: "/elements/jsxgraph",
    attributes: [
      { name: "height", description: "Height in pixels (default 600)" },
      { name: "width", description: "Width in pixels (default 800)" },
      { name: "boundingbox", description: "Visible area as `[left, top, right, bottom]`" },
      { name: "axis", description: "Show the axes (default `true`)", values: BOOL },
      { name: "grid", description: "Show the grid (default `true`)", values: BOOL },
    ],
    snippet: "jsxgraph\n```js\n${board.create('point', [1, 1]);}\n```\n:::",
  },
  {
    name: "mermaid",
    label: "Mermaid diagram",
    description: "A diagram written in Mermaid.",
    kind: "container",
    docs: "/elements/mermaid",
    attributes: [],
    snippet: "mermaid\n```mermaid\n${graph LR\n  A --> B}\n```\n:::",
  },
  {
    name: "plantuml",
    label: "PlantUML diagram",
    description: "A UML diagram written in PlantUML.",
    kind: "container",
    docs: "/elements/plantuml",
    attributes: [
      { name: "width", description: "Width of the image" },
      { name: "alt", description: "Alternative text" },
    ],
    snippet: "plantuml\n@startuml\n${Bob -> Alice : hello}\n@enduml\n:::",
  },
  {
    name: "scratchblock",
    label: "Scratch blocks",
    description: "Scratch code drawn as blocks.",
    kind: "container",
    docs: "/elements/scratchblock",
    attributes: [{ name: "language", description: "Language of the blocks, e.g. `de`" }],
    snippet: "scratchblock\n${when green flag clicked\nmove (10) steps}\n:::",
  },
  {
    name: "abc-music",
    label: "Music (ABC)",
    description: "Sheet music written in ABC notation.",
    kind: "container",
    docs: "/elements/abc-music",
    attributes: [],
    snippet: "abc-music\n```abcjs\n${X:1\nK:C\nCDEF GABc|}\n```\n:::",
  },
  {
    name: "h5p",
    label: "H5P",
    description: "H5P content from a .h5p file.",
    kind: "leaf",
    docs: "/elements/h5p",
    attributes: [
      { name: "src", description: "The .h5p file", file: true },
      { name: "export", description: "Show the Reuse button", flag: true },
      { name: "download-url", description: "What the Reuse button downloads", file: true },
    ],
    snippet: 'h5p{src="${/content.h5p}"}',
  },
  {
    name: "blockflow-player",
    label: "Scratch player",
    description: "Plays a Scratch project.",
    kind: "leaf",
    docs: "/elements/blockflow",
    attributes: [
      { name: "src", description: "The .sb3 file", file: true },
      { name: "width", description: "Width (default `100%`)" },
      height("600px"),
      { name: "aspectRatio", description: "Aspect ratio (default `4/3`)" },
    ],
    snippet: 'blockflow-player{src="${/project.sb3}"}',
  },
  {
    name: "blockflow-editor",
    label: "Scratch editor",
    description: "A Scratch editor with a tutorial; put `:::step` blocks inside and use four colons.",
    kind: "container",
    docs: "/elements/blockflow",
    attributes: [
      { name: "src", description: "The .sb3 file to start from", file: true },
      { name: "project", description: "A .blockflow/.json project file (made in the generator)", file: true },
      { name: "title", description: "Title of the tutorial" },
      { name: "width", description: "Width (default `100%`)" },
      height("700px"),
      { name: "aspectRatio", description: "Aspect ratio of the editor" },
      { name: "allowExtensions", description: "Allow Scratch extensions (default `true`)", values: BOOL },
      { name: "showCostumesTab", description: "Show the Costumes tab (default `true`)", values: BOOL },
      { name: "showSoundsTab", description: "Show the Sounds tab (default `true`)", values: BOOL },
      { name: "categories", description: "Toolbox categories, comma-separated" },
    ],
    snippet: ':blockflow-editor{title="${Tutorial}"}\n:::step{title="${Welcome}"}\n${First step}\n:::\n::::',
  },
  {
    name: "step",
    label: "Tutorial step",
    description: "One step inside `::::blockflow-editor`.",
    kind: "container",
    docs: "/elements/blockflow",
    parents: ["blockflow-editor"],
    attributes: [{ name: "title", description: "Title of the step" }],
    snippet: 'step{title="${Title}"}\n${Text}\n:::',
  },
  {
    name: "kirimoto",
    label: "Kiri:Moto",
    description: "A slicer for 3D printing, laser cutting and CNC.",
    kind: "leaf",
    docs: "/elements/kirimoto",
    attributes: [
      height("calc(100vh - 60px)"),
      { name: "mode", description: "Starting mode", values: ["FDM", "CAM", "LASER", "SLA"] },
      { name: "model", description: "An STL or model file to load", file: true },
      { name: "workspace", description: "A .kmz workspace (HTTPS with CORS)" },
      { name: "settings", description: "Shared settings key" },
    ],
    snippet: 'kirimoto{mode="${FDM}"}',
  },
];

const BY_NAME = new Map<string, Directive>();
for (const d of DIRECTIVES) {
  BY_NAME.set(d.name, d);
  for (const alias of d.aliases ?? []) BY_NAME.set(alias, d);
}

export function directive(name: string): Directive | undefined {
  return BY_NAME.get(name);
}

export function docsUrl(d: Directive): string {
  return DOCS + d.docs;
}

/** Settings a page sets in its frontmatter; see website/en/book/configuration/page.md. */
export const PAGE_DOCS = `${DOCS}/configuration/page`;
