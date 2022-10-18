---
name: Bereich Konfiguration
index: 2
lang: de
---

# Bereich Konfiguration

Jeder Ordner im `book`-Ordner definiert einen Bereich. Jeder dieser Ordner muss
eine `index.md` Datei enthalten. Diese Datei kann konfiguriert werden wie eine
[Seite](/configuration/page). Zusätzlich können noch weitere Eigenschaften definiert werden, die im
Folgenden dokumentiert sind.

| Property | Description                                                                                                                        |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| ...      | Jede Eigenschaft der [Seite](/configuration/page)                                                                                  |
| virtual  | Alles erscheint auf derselben Ebene wie der drüberliegende Ordner. Vorsicht: Die Index-Eigenschaft wirkt nicht über Ordner hinweg. |
| expanded | Definiert, ob der Bereich in der Navigation ausgeklappt sein soll.                                                                 |

Wenn die `index.md` Datei nur ein Frontmatter enthält und keinen Inhalt, dann wird der Bereich in der Navigation als nicht-klickbar angezeigt.
