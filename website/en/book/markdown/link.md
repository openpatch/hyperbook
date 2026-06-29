---
name: Link
permaid: link
---

# Link

There are two ways to create links.

```md
[Link in text](https://www.openpatch.org)

[Link in text with a title](https://www.openpatch.org "Webseite of OpenPatch")

[Reference link][case-insensitive reference text]

[Reference link with a number][1]

URLs and URLs in angle brackets will automatically get turned into links
http://www.example.com or <http://www.example.com>.

Some text to show that the reference links can follow later.

[case-insensitive reference text]: https://edugit.org
[1]: http://codeberg.org
```

[Link in text](https://www.openpatch.org)

[Link in text with a title](https://www.openpatch.org "Webseite of OpenPatch")

[Reference link][case-insensitive reference text]

[Reference link with a number][1]

URLs and URLs in angle brackets will automatically get turned into links
http://www.example.com or <http://www.example.com>.

Some text to show that the reference links can follow later.

[case-insensitive reference text]: https://edugit.org
[1]: http://codeberg.org

## Internal Links

You can link to other pages in your book using relative paths. Hyperbook automatically handles markdown file extensions, so you can use links with or without the `.md` extension:

```md
[With extension](./other-page.md)
[Without extension](./other-page)
```

Both links will point to the same page. This also works for other markdown file types:

```md
[Template file](./template.md.hbs)
[JSON file](./data.md.json) 
[YAML file](./config.md.yml)
```
