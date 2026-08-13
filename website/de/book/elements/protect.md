---
name: Geschützer Bereich
lang: de
keywords:
  - Passwort
  - Verschlüsselung
---

# Geschützer Bereich

Wenn du einen Bereich mit einem Passwort schützen möchtest, dann kannst du das
protect-Element verwenden.

Der Inhalt wird beim Bauen mit AES-256-GCM verschlüsselt. Der Schlüssel wird
mit PBKDF2 aus dem Passwort abgeleitet. Weder der Inhalt noch das Passwort
stehen in der gebauten Seite — der Browser entschlüsselt erst, nachdem das
Passwort eingegeben wurde.

## Attribute

| Attribut | Beschreibung | Standard |
|---|---|---|
| `password` | Passwort, das den Inhalt freischaltet | - |
| `use` | Schlüssel eines Passworts aus der [Passwortliste](/configuration/passwords) | - |
| `description` | Hinweis über dem Passwortfeld | - |
| `id` | Gemeinsame id, um mehrere Bereiche zusammen freizuschalten | automatisch |

```md
:::protect{password="hyperbook" description="Das Passwort ist der Name des Projekts."}

:smiley:

:::
```

:::protect{password="hyperbook" description="Das Passwort ist der Name des Projekts."}

:smiley:

:::

:::alert{info}
Versichere dich, dass du immer eine höhere Anzahl an `:` benutzen musst, wenn du etwas schützen möchtest was auch `:` verwendet.
:::

Mit der id kannst du mehrere Bereiche verbinden.

```md
:::protect{id="1" password="hyperbook" description="Das Passwort ist der Name des Projekts."}

:smiley:

:::

:::protect{id="1" password="hyperbook" description="Das Passwort ist der Name des Projekts."}

:apple:

:::
```

:::protect{id="1" password="hyperbook" description="Das Passwort ist der Name des Projekts."}

:smiley:

:::

:::protect{id="1" password="hyperbook" description="Das Passwort ist der Name des Projekts."}

:apple:

:::

## Benannte Passwörter

Statt ein Passwort überall zu wiederholen, kannst du es in eine
[Passwortliste](/configuration/passwords) schreiben und über seinen Namen
verwenden. So änderst du es an einer Stelle, und die Datei mit den Passwörtern
muss nicht in dein Repository.

```md
:::protect{use="kapitel-3"}

Die Lösung.

:::
```

Ein Schlüssel ohne Wert lässt den Build fehlschlagen. Ein Tippfehler kann
deinen Inhalt also nicht versehentlich hinter einem leeren Passwort
veröffentlichen. Mit `hyperbook passwords check` siehst du, was fehlt.

## Ganze Seiten und Abschnitte schützen

Ein `:::protect`-Block schützt einen Teil einer Seite. Um alles zu schützen,
setzt du `protect` im Frontmatter einer [Seite](/configuration/page) oder eines
[Abschnitts](/configuration/section).

```md
---
name: Lösungen
protect: kapitel-3
---
```

Bei einem Abschnitt — der `index.md` eines Ordners — erbt jede Seite und jeder
Unterabschnitt darin den Schutz. Geschützte Einträge behalten ihren Platz in
der Navigation und bekommen ein Schloss neben ihren Namen. So sehen Lesende,
dass es die Seite gibt und dass sie ein Passwort braucht.

Ein Passwort öffnet den ganzen Abschnitt: Freigeschaltet wird nach der Seite
oder dem Abschnitt, der `protect` gesetzt hat. Einmal eingegeben, sind alle
erbenden Seiten offen. Ein Unterabschnitt mit eigenem `protect` wird getrennt
freigeschaltet und bleibt zu.

Das Passwort für beide Demos unten ist `hyperbook`.

**[Zur Demo geschützte Seite →](/advanced/protect-page-demo)**

**[Zur Demo geschützter Abschnitt →](/advanced/protect-section-demo)**

## Verschachtelung

Geschützte Bereiche lassen sich verschachteln. Der innere Bereich wird zuerst
verschlüsselt. Das äußere Passwort gibt also nur den äußeren Inhalt frei — der
innere fragt weiterhin nach seinem eigenen Passwort.

```md
::::protect{use="schueler"}

Für die ganze Klasse sichtbar.

:::protect{use="lehrkraefte"}

Nur für Lehrkräfte sichtbar.

:::

::::
```

## Was der Schutz leistet und was nicht

Geschützte Inhalte tauchen nicht im Suchindex und nicht in `llms.txt` auf.
Überschriften innerhalb eines geschützten Bereichs erscheinen nicht im
Inhaltsverzeichnis.

:::alert{warn}
Der verschlüsselte Inhalt wird an den Browser ausgeliefert. Jede Person kann
also so schnell Passwörter durchprobieren, wie ihr Rechner es zulässt. Ein
kurzes oder erratbares Passwort schützt kaum. Nutze das, um Lösungen aus dem
Weg zu räumen, nicht für wirklich vertrauliche Dinge.

Dateien, die aus einem geschützten Bereich verlinkt werden — Bilder, Downloads,
Archive — landen wie gewohnt in der Ausgabe und bleiben unter ihrer normalen
Adresse erreichbar. Nur das HTML ist verschlüsselt.
:::

## Bücher ohne Webserver

Zum Entschlüsseln nutzt der Browser die Web-Crypto-API. Die gibt es nur über
`https` oder auf `localhost`. Ein Buch, das direkt von der Festplatte über eine
`file://`-Adresse geöffnet wird, kann nichts entschlüsseln.

Wenn du dein Buch als Ordner weitergibst, setze `protect.mode` in deiner
`hyperbook.json` auf `obfuscate`. Inhalt und Passwort stehen dann wie früher in
der Seite — das versteckt den Inhalt vor einem flüchtigen Blick und vor sonst
niemandem.

```json
{
  "protect": {
    "mode": "obfuscate"
  }
}
```

| Option | Beschreibung | Standard |
|---|---|---|
| `mode` | `encrypt` oder `obfuscate` | `encrypt` |
| `iterations` | PBKDF2-Runden. Mehr bedeutet langsameres Freischalten und langsameres Durchprobieren | `250000` |
| `passwordsFile` | Ort der Passwortliste | `passwords.json` |
