---
name: Web IDE
permaid: webide
---

# Web IDE

The Web IDE allows running HTML, CSS and JavaScript code in a sandboxed environment. It is useful for teaching and learning purposes, as well as for testing code snippets. It only supports one HTML, one CSS and one JS file.

## Usage

To use the Web IDE, you need to wrap your code in a `:::webide` block. Inside this block, you can use `html`, `css` and `js` code blocks. You can fill the code blocks with boilerplate, or you can leave them empty.

````md
:::webide

```js
```

```css
```

```html
<h1>My Heading</h1>
```

:::
````

:::webide

```js
```

```css
```

```html
<h1>My Heading</h1>
```

:::

### Hide tabs

You can hide tabs by remove the code block. For example, if you want to hide the CSS tab, you can remove the `css` code block.

````md
:::webide

```js
```

```html
<h1>My Heading</h1>
```

:::
````

:::webide

```js
```

```html
<h1>My Heading</h1>
```

:::

### Custom template

By default, the Web IDE uses a simple template. You can customize the template by adding a `html template` code block inside the `webide` block. The default code block is:

```html
<!DOCTYPE html>
<head>
    <title>WebIDE</title>
    <meta charset="utf8" />
    <style type='text/css'>
        html, body {
        margin: 0;
        padding: 0;
        background: white;
        }
        ###CSS###
    </style>
</head>
<body>###HTML###</body>
<script type="text/javascript">###JS###</script>
```

The `###CSS###`, `###HTML###` and `###JS###` placeholders will be replaced by the content of the `css`, `html` and `js` code blocks.

Here is an example of a custom template, for example if you want to add a custom library:

````md
:::webide

```js
// do this for 30 seconds
var duration = 30 * 1000;
var end = Date.now() + duration;

(function frame() {
  // launch a few confetti from the left edge
  confetti({
    particleCount: 7,
    angle: 60,
    spread: 55,
    origin: { x: 0 }
  });
  // and launch a few from the right edge
  confetti({
    particleCount: 7,
    angle: 120,
    spread: 55,
    origin: { x: 1 }
  });

  // keep going until we are out of time
  if (Date.now() < end) {
    requestAnimationFrame(frame);
  }
}());
```

```html
<h1>Celebrate</h1>
```

```html template
<!DOCTYPE html>
<head>
    <title>WebIDE</title>
    <meta charset="utf8" />
    <style type='text/css'>
        html, body {
        margin: 0;
        padding: 0;
        background: white;
        }
        ###CSS###
    </style>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>
</head>
<body>###HTML###</body>
<script type="text/javascript">###JS###</script>
```

:::
````

:::webide

```js
// do this for 30 seconds
var duration = 30 * 1000;
var end = Date.now() + duration;

(function frame() {
  // launch a few confetti from the left edge
  confetti({
    particleCount: 7,
    angle: 60,
    spread: 55,
    origin: { x: 0 }
  });
  // and launch a few from the right edge
  confetti({
    particleCount: 7,
    angle: 120,
    spread: 55,
    origin: { x: 1 }
  });

  // keep going until we are out of time
  if (Date.now() < end) {
    requestAnimationFrame(frame);
  }
}());
```

```html
<h1>Celebrate</h1>
```

```html template
<!DOCTYPE html>
<head>
    <title>WebIDE</title>
    <meta charset="utf8" />
    <style type='text/css'>
        html, body {
        margin: 0;
        padding: 0;
        background: white;
        }
        ###CSS###
    </style>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>
</head>
<body>###HTML###</body>
<script type="text/javascript">###JS###</script>
```

:::

## Example 

````md
:::webide

```js
let a = document.getElementsByClassName("my-class");
a[0].style.backgroundColor = "palevioletred";
```

```css
.my-class {
  color: papayawhip;
  font-size: 20px;
  text-weight: bold;
  text-align: center;
  padding: 10px;
}
```

```html
<div class="my-class">Test</div>
```

:::
````

:::webide

```js
let a = document.getElementsByClassName("my-class");
a[0].style.backgroundColor = "palevioletred";
```

```css
.my-class {
  color: papayawhip;
  font-size: 20px;
  text-weight: bold;
  text-align: center;
  padding: 10px;
}
```

```html
<div class="my-class">Test</div>
```

:::
