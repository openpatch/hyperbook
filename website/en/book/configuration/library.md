---
name: Library Configuration
---

# Library Configuration

A Hyperlibrary is a collection of Hyperbooks and Hyperlibraries. You can use it
to merge several books into one big one. The books are automatically linked to
each other. For this purpose a new link will be added to the links in the upper
right corner. In its submenus you will find the linked Hyperbooks.

This documentation is also a Hyperlibrary. For the translations there is
a separate Hyperbook for each translation. These individual Hyperbooks are combined in a
Hyperlibrary. The menu item 'Translations' is the product of this linkage.

All you have to do is create a `hyperlibrary.json` file.

| Property           | Description                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| name\*             | Name of the library.                                                                                                    |
| books[]            | An array of books and libraries.                                                                                        |
| books[].src\*      | Path to a book or library.                                                                                              |
| books[].basePath\* | Overwrites the basePath of a book or library.                                                                           |
| books[].icon       | An icon für the menu.                                                                                                   |
| books[].name       | A name für the menu. If no name is provided, it will use the one defined in the `hyperbook.json` or `hyperlibrary.json` |
| basePath           | Defines the basePath of the library.                                                                                    |

Here is an example of a `hyperlibrary.json`:

```json
{
  "name": "Translations",
  "books": [
    { "src": "de", "name": "Deutsch", "basePath": "de", "icon": "🇩🇪" },
    { "src": "en", "name": "English", "basePath": "/", "icon": "🇬🇧" }
  ]
}
```

You can also define translations. The translations will be selected based on
the `lanauge` option in the corresponding `hyperbook.json`

```json
{
  "name": { "en": "Translations", "de": "Übersetzungen" },
  "books": [
    {
      "src": "de",
      "name": { "en": "German", "de": "Deutsch" },
      "basePath": "de",
      "icon": "🇩🇪"
    },
    {
      "src": "en",
      "name": { "en": "English", "de": "Englisch" },
      "basePath": "/",
      "icon": "🇬🇧"
    }
  ]
}
```

:::alert{warn}
`hyperbook dev` funktioniert noch nicht mit Hyperlibrary. Der aktuelle Workaround besteht darin, die Hyperbook separat mit `hyperbook dev` zu starten. Daher fehlt bei der lokalen Entwicklung das verknüpfende Menü.
:::
