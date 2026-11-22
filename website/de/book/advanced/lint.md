---
name: Lint
permaid: lint
---

# Lint

`hyperbook lint` findet Fehler in deinen Seiten, ohne das Buch zu bauen. Jede Seite durchläuft dieselbe Verarbeitung wie beim Bauen, aber es wird nichts geschrieben.

```sh
hyperbook lint                  # alle Seiten des Buchs oder der Bibliothek
hyperbook lint book/intro.md    # nur diese Seiten oder Ordner
hyperbook lint --json           # maschinenlesbar, für Skripte und KI-Agenten
```

Gemeldet wird:

| Regel | Bedeutung |
| --- | --- |
| `unknown-directive` | Ein Elementname, den Hyperbook nicht kennt, z. B. `:::alret`. Sein Inhalt fehlt auf der Seite. Lint schlägt den ähnlichsten Namen vor. |
| `unclosed-directive` | Ein `:::`-Block ohne schließendes `:::`. Alles danach landet in dem Block. |
| `malformed-directive` | Eine Zeile, die ein Element sein sollte, aber nicht gelesen werden konnte, z. B. `:: youtube` mit Leerzeichen oder ein nicht geschlossenes Anführungszeichen in `{…}`. Sie erscheint als Text. |
| `stray-directive-fence` | Ein `:::`, das nichts schließt. Es erscheint als Text. |
| `unknown-attribute` | Ein Attribut, das das Element nicht liest, z. B. `titel=` bei `:::collapsible`. Es hat keine Wirkung. Lint schlägt das ähnlichste vor. |
| `invalid-attribute-value` | Ein Wert, den das Element nicht kennt, z. B. `mode="edit"` bei `:::p5` (erlaubt sind `preview` und `editor`). |
| `missing-file` | Eine Datei, auf die ein Element zeigt (`src`, `poster`, …), die weder in `public/` noch neben der Seite liegt. |
| `broken-link` | Ein Link oder Bild, das auf eine nicht vorhandene Seite oder Datei zeigt. |
| `duplicate-permaid` | Zwei Seiten mit derselben `permaid`. |
| `unknown-config-key` | Eine Option in `hyperbook.json`, die Hyperbook nicht kennt. |
| `not-a-page` | Ein an Lint übergebener Pfad ist keine Seite des Buchs. |

Außerdem melden die Elemente ihre eigenen Probleme, etwa ein fehlendes `src`-Attribut oder ein Element mit der falschen Anzahl Doppelpunkte (`wrong-directive-form`). Das sind dieselben Meldungen, die `hyperbook build` ausgibt, und jede hat eine Regel.

Lint endet mit Code 1, wenn es einen Fehler oder eine Warnung findet. Mit `--strict` führen auch Hinweise (infos) zum Fehlschlag.

## Für KI-Agenten

Schreib etwas wie das Folgende in die `AGENTS.md` oder `CLAUDE.md` deines Buchs, damit ein Agent seine Arbeit selbst prüft:

```md
After editing pages, run `npx hyperbook lint --json <changed files>` and fix
every finding before you finish. Each finding has a file, line, rule and message.
```

Die JSON-Ausgabe sieht so aus:

```json
{
  "ok": false,
  "pages": 1,
  "errors": 0,
  "warnings": 1,
  "infos": 0,
  "findings": [
    {
      "file": "book/index.md",
      "line": 5,
      "column": 1,
      "severity": "warning",
      "rule": "unknown-directive",
      "message": "Unknown directive \":::alret\". It is shown as plain text and its content is dropped. Did you mean \":::alert\"?"
    }
  ]
}
```
