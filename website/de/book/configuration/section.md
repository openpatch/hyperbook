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

| Property   | Description                                                                                                                        |
| :--------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| ...        | Jede Eigenschaft der [Seite](/configuration/page)                                                                                  |
| index      | Eine Zahl, die die Position relativ zu den Seiten und den anderen Bereichen auf dieser Navigationsebene angibt. Ohne sie steht ein Bereich hinter den Seiten. |
| virtual    | Alles erscheint auf derselben Ebene wie der drüberliegende Ordner. Vorsicht: Die Index-Eigenschaft wirkt nicht über Ordner hinweg. (veraltet, verwende stattdessen `navigation: virtual`) |
| expanded   | Definiert, ob der Bereich in der Navigation ausgeklappt sein soll. (veraltet, verwende stattdessen `navigation: expanded`)        |
| navigation | Steuert wie der Bereich in der Navigation angezeigt wird. Optionen: `default` (aufklappbarer Bereich), `hidden` (versteckt in der Navigation), `virtual` (Elemente erscheinen auf Elternebene), `page` (wird als normaler Seitenlink angezeigt ohne Kinder anzuzeigen), `expanded` (Bereich ist standardmäßig ausgeklappt) |
| protect | Schützt den Bereich mit einem Passwort. Jede Seite und jeder Unterbereich darin erbt das, sofern nicht selbst `protect` gesetzt ist. Siehe [Passwörter](/configuration/passwords) |

Wenn die `index.md` Datei nur ein Frontmatter enthält und keinen Inhalt, dann wird der Bereich in der Navigation als nicht-klickbar angezeigt.
