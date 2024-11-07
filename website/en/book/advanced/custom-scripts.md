---
name: Custom Scripts
scripts:
  - /custom_script.js
---

# Custom Scripts

:::alert{warn}
Custom scripts are best used with `allowDangerousHtml` enabled. It is highly recommended to not target hyperbook elements and to only target custom elements. The classes we use for the hyperbook are not considered stable and might change in the future. Therefore, target hyperbook elements only with caution.
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
