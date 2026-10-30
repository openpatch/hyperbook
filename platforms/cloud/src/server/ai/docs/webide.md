# webide (Web IDE)

`:::webide` is a small web IDE (HTML/CSS/JS) for readers. One fenced block per
file, with the file name in the fence — the first one is usually
`html index.html`.

    :::webide

    ```html index.html
    <h1>Hello</h1>
    ```

    ```css style.css
    h1 { color: teal; }
    ```

    ```js script.js
    console.log("hi");
    ```

    :::

## Compare with a solution (CSSBattle-style)

Add the `compare` flag and a solution file with `role="solution"`: readers rebuild
a given page as exactly as possible and are scored while they type.

    :::webide{compare pass=95}

    ```html index.html
    <!DOCTYPE html>
    <html><head><link rel="stylesheet" href="style.css" /></head>
    <body><div class="box"></div></body></html>
    ```

    ```html file="solution.html" role="solution"
    ... the target page ...
    ```

    :::

- The reader's page and the solution render at the same size; the reader's page
  shows in a frame of the compared size — 400×300 by default, or `compare="WxH"`.
- The target lies over the reader's output at first; a draggable line splits
  "Yours" (left) and "Target" (right), then moves to the middle after the first
  change. The panel shows **Overlay**, **Differences**, and (hold) **Target**,
  plus the target's colours — click one to copy its hex value. Solved: green outline.
- Score = **Colour** 50% (every pixel incl. background, partial credit for close
  colours) + **Outline** 30% (edges) + **Area** 20% (coverage). One pixel off still
  matches fully. Solved when the total *and each part* reach `pass` (default 98),
  so a wrong-coloured shape does not pass on outline alone. Hover the score for parts.
