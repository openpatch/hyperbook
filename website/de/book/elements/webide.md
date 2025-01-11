---
name: Web IDE
permaid: webide
lang: de
---

# Web IDE

Die Web IDE ermöglicht das Ausführen von HTML-, CSS- und JavaScript-Code in einer isolierten Umgebung. Sie ist nützlich für Lehr- und Lernzwecke sowie zum Testen von Code-Snippets. Es wird nur eine HTML-, eine CSS- und eine JS-Datei unterstützt.

## Verwendung

Um die Web IDE zu verwenden, müssen Sie Ihren Code in einen `:::webide` Block einfügen. Innerhalb dieses Blocks können Sie `html`, `css` und `js` Codeblöcke verwenden. Sie können die Codeblöcke mit Boilerplate füllen oder leer lassen.

````md
:::webide

```js
```

```css
```

```html
<h1>Meine Überschrift</h1>
```

:::
````

:::webide

```js
```

```css
```

```html
<h1>Meine Überschrift</h1>
```

:::

### Tabs ausblenden

Sie können Tabs ausblenden, indem Sie den entsprechenden Codeblock entfernen. Wenn Sie beispielsweise den CSS-Tab ausblenden möchten, können Sie den `css` Codeblock entfernen.

````md
:::webide

```js
```

```html
<h1>Meine Überschrift</h1>
```

:::
````

:::webide

```js
```

```html
<h1>Meine Überschrift</h1>
```

:::

### Benutzerdefinierte Vorlage

Standardmäßig verwendet die Web IDE eine einfache Vorlage. Sie können die Vorlage anpassen, indem Sie einen `html template` Codeblock innerhalb des `webide` Blocks hinzufügen. Der Standard-Codeblock ist:

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

Die Platzhalter `###CSS###`, `###HTML###` und `###JS###` werden durch den Inhalt der `css`, `html` und `js` Codeblöcke ersetzt.

Hier ist ein Beispiel für eine benutzerdefinierte Vorlage, wenn Sie beispielsweise eine benutzerdefinierte Bibliothek hinzufügen möchten:

````md
:::webide

```js
// mache dies für 30 Sekunden
var duration = 30 * 1000;
var end = Date.now() + duration;

(function frame() {
  // starte ein paar Konfetti vom linken Rand
  confetti({
    particleCount: 7,
    angle: 60,
    spread: 55,
    origin: { x: 0 }
  });
  // und starte ein paar vom rechten Rand
  confetti({
    particleCount: 7,
    angle: 120,
    spread: 55,
    origin: { x: 1 }
  });

  // weitermachen, bis die Zeit abgelaufen ist
  if (Date.now() < end) {
  requestAnimationFrame(frame);
  }
}());
```

```html
<h1>Feiern</h1>
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
// mache dies für 30 Sekunden
var duration = 30 * 1000;
var end = Date.now() + duration;

(function frame() {
  // starte ein paar Konfetti vom linken Rand
  confetti({
    particleCount: 7,
    angle: 60,
    spread: 55,
    origin: { x: 0 }
  });
  // und starte ein paar vom rechten Rand
  confetti({
    particleCount: 7,
    angle: 120,
    spread: 55,
    origin: { x: 1 }
  });

  // weitermachen, bis die Zeit abgelaufen ist
  if (Date.now() < end) {
    requestAnimationFrame(frame);
  }
}());
```

```html
<h1>Feiern</h1>
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

## Beispiel

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
