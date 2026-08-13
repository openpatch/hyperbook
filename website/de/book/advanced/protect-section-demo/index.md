---
name: Demo geschützter Abschnitt
lang: de
protect:
  password: hyperbook
  description: Das Passwort ist der Name des Projekts.
---

# Demo geschützter Abschnitt

Das hier ist ein Abschnitt — ein Ordner mit einer `index.md`. Sein Frontmatter
setzt `protect`, und alles im Ordner erbt das.

Sieh in die Navigation: sowohl dieser Abschnitt als auch die
[Seite darin](/advanced/protect-section-demo/inherited) tragen ein Schloss,
obwohl in deren Frontmatter nichts von Passwörtern steht.

## Das Frontmatter hinter diesem Abschnitt

Hier steht die Objektform statt eines Namens aus der Passwortliste, damit du
beide Wege siehst:

```md
---
name: Demo geschützter Abschnitt
protect:
  password: hyperbook
  description: Das Passwort ist der Name des Projekts.
---
```

## Wie weit das reicht

Das Erben geht bis nach unten durch: Seiten, Unterabschnitte und Seiten in
diesen Unterabschnitten. Eine Seite oder ein Unterabschnitt mit eigenem
`protect` behält es. Der Schutz summiert sich nicht — wer einen verschachtelten
Abschnitt liest, braucht nur dessen Passwort, nicht beide.

```
book/
└── loesungen/
    ├── index.md        protect: kapitel-3
    ├── eins.md         erbt kapitel-3
    └── zusatz/
        ├── index.md    protect: zusatzaufgabe   ← überschreibt
        └── zwei.md     erbt zusatzaufgabe
```

## Eine Übersicht für dich selbst

Ein geschützter Abschnitt ist ein guter Ort für eine
[Passwortliste](/elements/passwordlist) — alles, was diese Dokumentation
verwendet, hinter dem Passwort, das du gerade eingegeben hast:

::passwordlist

Jedes Passwort erscheint einmal für den Eintrag in der Passwortliste und einmal
für jede Stelle, an der es verwendet wird.
