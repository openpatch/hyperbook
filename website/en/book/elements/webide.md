---
name: Web IDE
permaid: webide
---

# Web IDE

The Web IDE runs a small website of HTML, CSS and JavaScript files in a sandboxed frame. The page updates while you type. It is useful for teaching and learning, as well as for trying out code snippets.

## Usage

Write the page as an `html` code block inside a `:::webide` block. It is the website's `index.html`. Further files get a name with `file="…"` and show up as tabs; `index.html` links them as it would on any web server.

````md
:::webide

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My page</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <h1 class="title">My Heading</h1>
    <script src="script.js"></script>
  </body>
</html>
```

```css file="style.css"
.title {
  color: palevioletred;
}
```

```js file="script.js"
document.querySelector(".title").textContent += "!";
```

:::
````

:::webide

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My page</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <h1 class="title">My Heading</h1>
    <script src="script.js"></script>
  </body>
</html>
```

```css file="style.css"
.title {
  color: palevioletred;
}
```

```js file="script.js"
document.querySelector(".title").textContent += "!";
```

:::

The frame's title bar shows the page's `<title>`.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `height` | Height of the Web IDE | `calc(100dvh - 80px)` |
| `main` | The page shown in the frame | `index.html` |
| `id` | Where the reader's code is saved | derived from the content |
| `files` | What readers may do with files: `create`, `upload`, `rename`, `delete`, comma-separated, or `open` for all | none |
| `accept` | Extensions of files readers create or rename, comma-separated | `.html,.css,.js` |

## Files

Mark a file `readonly` to show it without letting readers change it, or `hidden` to keep it out of the editor while the page still loads it. `::file{path="…" src="…"}` adds a file from your book, for example an image the page shows or a library it loads:

````md
:::webide

```html
<img src="logo.png" alt="Logo" />
<script src="confetti.js"></script>
```

::file{path="logo.png" src="/logo.png"}
::file{path="confetti.js" src="/js/confetti.js" hidden}

:::
````

Libraries from a CDN work too: link them by their full URL.

## Files readers may change

With `files`, readers get buttons for their own files: **+** creates a file, **⤒** uploads one, and each tab gets **✎** to rename and **×** to delete it. `rename` and `delete` allow it for the files of the page too; the main file and `readonly`, `hidden` and test files always stay as written. Files readers created or uploaded they can always rename and delete. Clicking the tab of a binary file shows a preview: images, audio and video, PDFs, fonts (TTF, OTF, WOFF) and 3D models (STL, OBJ), which you can turn and zoom.

````md
:::webide{files="create,upload,rename,delete"}
...
:::
````

## Compare with a solution

Like on [CSSBattle](https://cssbattle.dev/), readers can try to build a given page as exactly as possible. Add `compare` and a page with `role="solution"`: the solution and the reader's page are rendered at the same size, and the page is scored as the reader types. The picture to draw lies over the reader's own output, at the same size and place, and covers it at first. A line divides them: the reader's drawing on the left ("Yours"), the target on the right ("Target"). After the first change the line moves to the middle; readers drag it by its handle, or with the slider below. The panel below shows the match and the target's colours (click one to copy its hex value). **Overlay** shows the target half see-through over the whole drawing, **Differences** marks what did not match, and holding **Target** shows all of the target. Once solved, the picture is outlined in green.

The score has three parts. **Colour** (half of it) compares every pixel, the background too, with partial credit for colours that are close. **Outline** (30 %) checks that the edges of shapes are where the target has them. **Area** (20 %) checks that the drawn areas cover each other, whatever their colour. Outline and area look only at the drawing, so an empty canvas gets nothing for them and scores at most half. Anything one pixel off still matches fully. A task is solved when the score and each of its parts reach `pass`, so a shape in the wrong colour does not pass on its outline alone. Hovering the score shows the three parts.

````md
:::webide{compare pass=95}

```html
<!DOCTYPE html>
<html>
  <head><link rel="stylesheet" href="style.css" /></head>
  <body><div class="box"></div></body>
</html>
```

```css file="style.css"
body { margin: 0; background: #5d3a3a; }
.box { width: 150px; height: 150px; background: #b5e0ba; }
```

```html file="solution.html" role="solution"
<!DOCTYPE html>
<html>
  <head><link rel="stylesheet" href="style.css" /></head>
  <body style="margin: 0; background: #5d3a3a">
    <div style="width: 200px; height: 200px; margin: 50px 100px; background: #b5e0ba; border-radius: 50%"></div>
  </body>
</html>
```

:::
````

:::webide{compare pass=95 height=480}

```html
<!DOCTYPE html>
<html>
  <head><link rel="stylesheet" href="style.css" /></head>
  <body><div class="box"></div></body>
</html>
```

```css file="style.css"
body { margin: 0; background: #5d3a3a; }
.box { width: 150px; height: 150px; background: #b5e0ba; }
```

```html file="solution.html" role="solution"
<!DOCTYPE html>
<html>
  <head><link rel="stylesheet" href="style.css" /></head>
  <body style="margin: 0; background: #5d3a3a">
    <div style="width: 200px; height: 200px; margin: 50px 100px; background: #b5e0ba; border-radius: 50%"></div>
  </body>
</html>
```

:::

The solution page is shown with the reader's other files, so it can link the same `style.css`. A page has no size of its own, so both pages are rendered at the same size: 400×300 pixels, or what `compare="600x400"` gives. The reader's page is shown in a frame of that size, and only what fits in it counts. `pass` (default `98`) is the match in percent that counts as solved. Scripts run before the picture is taken.

A page is drawn for comparing through an SVG image, which cannot load anything itself: stylesheets, images and canvases are put in, but CSS background images (`url(…)`) and fonts from other servers are left out. This happens to the solution as well, so the comparison stays fair, but use colours, shapes and the browser's fonts for such tasks. The solution is part of the page, so readers who look into the page's source can find it.

## Upgrading from the old syntax

The Web IDE used to take one unnamed `html`, `css` and `js` block each and put them into a fixed template, which an `html template` block could replace. Run `npx hyperbook migrate` in your book to turn such pages into an `index.html` with linked `style.css` and `script.js`.
