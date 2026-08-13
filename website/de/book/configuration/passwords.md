---
name: Passwörter
lang: de
index: 5
permaid: passwords
keywords:
  - Passwort
  - protect
---

# Passwörter

Ein [geschützter Bereich](/elements/protect) kann sein Passwort direkt
mitbringen. Das funktioniert, bedeutet aber, dass das Passwort in deinem
Markdown steht, überall wiederholt wird und mit dem Rest des Buchs eingecheckt
wird.

Die Alternative ist eine Passwortliste: eine Datei, die Namen auf Passwörter
abbildet. Bereiche, Seiten und Abschnitte verweisen dann auf den Namen.

```json
{
  "$schema": "https://hyperbook.openpatch.org/schemas/passwords.schema.json",
  "passwords": {
    "kapitel-3": {
      "value": "kepler",
      "description": "Lösungen zu Kapitel 3"
    }
  }
}
```

```md
:::protect{use="kapitel-3"}

Die Lösung.

:::
```

Die Kurzform geht auch, wenn du keine Beschreibung brauchst:

```json
{
  "passwords": {
    "kapitel-3": "kepler"
  }
}
```

:::alert{warn}
In `passwords.json` stehen deine echten Passwörter. Trage die Datei in deine
`.gitignore` ein, wenn dein Buch öffentlich ist, und gib die Werte beim Bauen
über die Umgebung mit. Bücher aus `create-hyperbook` ignorieren sie bereits.

Diese Dokumentation ist die Ausnahme: ihre Passwortliste ist eingecheckt, weil
das eine Passwort darin öffentlich sein soll, damit die Demos funktionieren.
Nimm das nicht als Vorbild.
:::

Die Demos, die es öffnet:

**[Demo geschützte Seite →](/advanced/protect-page-demo)**

**[Demo geschützter Abschnitt →](/advanced/protect-section-demo)**

## Woher die Werte kommen

Hyperbook liest die Passwortliste an diesen Stellen, in dieser Reihenfolge.
Spätere gewinnen.

| Quelle | Beschreibung |
|---|---|
| `passwords.json` | Im Buchordner, neben `hyperbook.json`. Eine fehlende Datei ist in Ordnung |
| `HYPERBOOK_PASSWORDS_FILE` | Pfad zu einer Passwortliste an einem anderen Ort |
| `HYPERBOOK_PASSWORDS` | Die Passwortliste als JSON, direkt in der Variable |
| `HYPERBOOK_PASSWORD_<KEY>` | Ein einzelnes Passwort. Aus `kapitel-3` wird `HYPERBOOK_PASSWORD_KAPITEL_3` |

So kannst du die Datei aus deinem Repository heraushalten und die Passwörter
stattdessen in deiner CI setzen:

```sh
HYPERBOOK_PASSWORD_KAPITEL_3=kepler hyperbook build
```

Oder die ganze Liste auf einmal übergeben:

```sh
HYPERBOOK_PASSWORDS='{"passwords":{"kapitel-3":"kepler"}}' hyperbook build
```

Wenn die Datei woanders liegen soll, verweise in deiner `hyperbook.json`
darauf:

```json
{
  "protect": {
    "passwordsFile": "../secrets/passwords.json"
  }
}
```

## Fehlende Passwörter brechen den Build ab

Verweist ein `use` auf einen Namen ohne Wert, schlägt `hyperbook build` fehl
und nennt Datei und Zeile. Es wird kein leeres Passwort verwendet — das würde
deinen Inhalt hinter einem Schlüssel verschlüsseln, den jede Person errät.

## Der passwords-Befehl

`hyperbook passwords` zeigt, was ein Buch verwendet, ohne etwas davon in die
gebaute Seite zu schreiben.

### list

```sh
hyperbook passwords list
```

```
KEY        PASSWORD  SOURCE  WHERE            LOCATION            DESCRIPTION
kapitel-3  kepler    file    section          loesungen/index.md  Lösungen zu Kapitel 3
kapitel-3  kepler    file    page, inherited  loesungen/eins.md   Lösungen zu Kapitel 3
kapitel-3  kepler    file    registry                             Lösungen zu Kapitel 3
```

| Option | Beschreibung |
|---|---|
| `--json` | Ausgabe als JSON |
| `--type <types>` | Nur `registry`, `section`, `page` oder `block` |
| `--filter <regex>` | Nur Einträge, die zum Muster passen |

### init

```sh
hyperbook passwords init --generate
```

Durchsucht das Buch nach allen verwendeten Namen und schreibt eine
Passwortliste mit ihnen. `--generate` füllt zufällige Passwörter ein.

Vorhandene Werte bleiben erhalten — ein erneuter Aufruf nach einer neuen
geschützten Seite ergänzt nur den neuen Namen. `--force` ersetzt auch bereits
gesetzte Werte.

### check

```sh
hyperbook passwords check
```

Endet mit einem Fehler, wenn ein verwendeter Name keinen Wert hat, und nennt
Datei und Zeile. Führe das in der CI vor `hyperbook build` aus.

Zusätzlich warnt der Befehl — ohne fehlzuschlagen — vor Namen, die niemand
verwendet, und vor zwei Namen mit demselben Passwort. Letzteres bedeutet
meistens, dass ein Wechsel des einen den anderen unbemerkt offen lässt.

## Passwörter im Buch auflisten

Das Element [Passwortliste](/elements/passwordlist) bringt dieselben Angaben
auf eine Seite. Lies dort zuerst die Warnung: es schreibt Passwörter in die
gebaute Seite.
