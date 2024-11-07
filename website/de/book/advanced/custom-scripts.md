---
name: Benutzerdefinierte Skripte
scripts:
  - /custom_script.js
lang: de
---

# Benutzerdefinierte Skripte

:::alert{warn}
Benutzerdefinierte Skripte sollten am besten mit aktivierter Option `allowDangerousHtml` verwendet werden. Es wird dringend empfohlen, keine Hyperbook-Elemente anzusprechen und nur benutzerdefinierte Elemente zu targeten. Die Klassen, die wir für das Hyperbook verwenden, gelten nicht als stabil und könnten sich in der Zukunft ändern. Daher sollten Hyperbook-Elemente nur mit Vorsicht angesprochen werden.
:::

```md title="Frontmatter"
scripts:
  - /custom_script.js
```

```js title="custom_script.js"
const colors = ["red", "blue", "yellow", "green", "pink"];
const els = document.getElementsByClassName("random-color");
for (let el of els) {
  setInterval(() => {
    const color = colors[Math.floor(Math.random() * colors.length)];
    el.style.color = color;
  }, 500);
}
```

<div class="random-color">Am I a Chameleon?</div>
