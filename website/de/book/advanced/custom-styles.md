---
name: Benutzerdefinierte Stile
styles:
  - /custom_style.css
lang: de
---

# Benutzerdefinierte Stile

:::alert{warn}
Benutzerdefinierte Stile sollten am besten mit aktivierter Option `allowDangerousHtml` verwendet werden. Es wird dringend empfohlen, keine Hyperbook-Elemente zu stylen und nur benutzerdefinierte Elemente zu stylen. Die Klassen, die wir für das Hyperbook verwenden, gelten nicht als stabil und könnten sich in der Zukunft ändern. Daher sollten Hyperbook-Elemente nur mit Vorsicht gestylt werden.
:::

```md title="Frontmatter"
styles:
  - /custom_style.css
```

```css title="custom_style.css
.custom {
	color: red;
	font-size: 3rem;
}
```

<div class="custom">I am styled!</div>
