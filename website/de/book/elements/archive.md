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
