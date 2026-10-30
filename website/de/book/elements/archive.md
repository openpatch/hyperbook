---
name: Archiv
lang: de
---

# Archiv

Alle Ordner im Ordener `archives` werden gezippt, wenn du dein Hyperbook erstellst.
Du kannst das `archive` Element benutzen, um einen Downloadbutton für
ein gezipptes Archiv anzeigen zu lassen. Du musst nur den Namen des Ordners angeben, der Rest wird für dich übernommen.

```md
:archive[Projekt Vorlage]{name="project-1"}
```

:archive[Projekt Vorlage]{name="project-1"}

Archive sind zum Beispiel nützlich, um Projekt Vorlagen oder Lösungen
für Programmierprobleme bereitzustellen.

## Attribute

| Attribut  | Beschreibung                                                                                                                                                                      | Standard |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `name`    | Ordnername im Verzeichnis `archives`                                                                                                                                              | -        |
| `include` | Kommagetrennte Liste von `src=dest`-Paaren, die ins ZIP gepackt werden. `src` ist eine Datei oder ein Ordner im Buch (beginnend mit `/`), `dest` ist der Pfad innerhalb des ZIPs. | -        |

## Includes

Mit `include` kannst du beim Bauen des Buches zusätzliche Dateien oder Ordner
ins ZIP packen — ohne sie nach `archives/` zu kopieren. So kann sich ein Buch
einen Ordner zwischen einer Seite und einem Archiv teilen:

```md
:archive[Projekt: Spielwerkstatt]{name="spielwerkstatt" include="/book/projekte/spielwerkstatt/assets=assets"}
```

Dies zippt den Ordner `archives/spielwerkstatt/` und packt den Ordner
`book/projekte/spielwerkstatt/assets` unter dem Namen `assets` mit ins ZIP.
Mehrere Paare können durch Kommas getrennt angegeben werden:

```md
:archive[Projekt: Spielwerkstatt]{name="spielwerkstatt" include="/book/projekte/spielwerkstatt/assets=assets,/public/README.md=docs/README.md"}
```

Die Regeln:

- `src` beginnt mit `/` und wird relativ zum Wurzelverzeichnis des Buches
  aufgelöst. Es kann eine Datei oder ein Ordner sein; ein Ordner wird
  rekursiv eingefügt, einschließlich Dotfiles. Es muss im Buch bleiben.
- `dest` ist der Pfad innerhalb des ZIPs. Er ist relativ und darf kein `..`
  enthalten.
- Fehlt `src`, oder existiert `dest` bereits im Archiv, schlägt der Build
  fehl — mit einer Fehlermeldung, die die Seite nennt, die das Include
  deklariert hat.

## Symbolische Links

Ein symbolischer Link in einem Archiv-Ordner wird aufgelöst: Ins ZIP kommen die
Dateien, auf die er zeigt, nicht der Link. So kann sich ein Archiv einen Ordner
mit dem Buch teilen, ohne eine zweite Kopie, zum Beispiel einen Ordner `assets`
neben einer Seite:

```
archives/spiel/
  Main.java
  assets -> ../../book/kapitel/assets
```

Unter Windows checkt Git symbolische Links als einfache Textdateien aus, solange
sie nicht eingeschaltet sind (`git config core.symlinks true`).

Symbolische Links funktionieren nur beim Bauen aus dem entpackten Ordner.
Hyperbook Cloud nimmt Bücher nur als ZIP-Upload an, und ein ZIP kann keine
symbolischen Links transportieren — die Plattform lässt solche Einträge weg.
Benutze stattdessen das Attribut `include`: Es fügt dieselben Dateien beim Bauen
ins ZIP ein und funktioniert überall.
