---
"@hyperbook/web-component-excalidraw": minor
"hyperbook": minor
"@hyperbook/markdown": minor
"hyperbook-studio": minor
"@hyperbook/types": minor
"@hyperbook/fs": minor
---

The release is a complete rewrite of the underlying process to generate the
HTML files. React was removed from the project and replaced with remark
plugins. This improves build times and give us more control over the whole
process. For example there is no need anymore for running `npx hyperbook
setup`.

I also added a new pagelist directive, which can be used to list pages based
on user-defined criteria. This directive also replaces the included glossary
page. Therefore, you need to create on yourself. This can be easily done by
creating a page `glossary.md` with the following content:

```md
---
name: Glossary
---

::pagelist{format="glossary" source="href(/glossary/)"}

```

Additionally, I added the ability to use custom JavaScript and CSS-files - see
the documentation under Advanced Features - in addition to using HTML in your
hyperbook, when the `allowDangerousHtml` option is enabled in your config.

I also improved the appearance of custom links, by moving them to the
footer on mobile devices.
