---
name: Demo geschützte Seite
protect: demo
lang: de
---

# Demo geschützte Seite

Du bist drin. Alles auf dieser Seite war verschlüsselt, bis du das Passwort
eingegeben hast.

Sichtbar war vorher nur:

- der Name der Seite in der Navigation, mit einem Schloss daneben
- der Brotkrumenpfad und der Seitentitel im Browser-Tab
- sonst nichts — weder diese Überschrift noch das Inhaltsverzeichnis

Das ist der Unterschied zwischen `protect` auf einer Seite und einem
[geschützten Bereich](/elements/protect). Ein Bereich verbirgt einen Teil einer
Seite, die du ansonsten lesen kannst. Der Schutz auf Seitenebene verbirgt die
ganze Seite.

## Das Frontmatter hinter dieser Seite

```md
---
name: Demo geschützte Seite
protect: demo
---

# Demo geschützte Seite

...
```

`demo` ist ein Name aus der [Passwortliste](/configuration/passwords) dieser
Dokumentation. Sie ist absichtlich eingecheckt, damit diese Demos funktionieren:

```json
{
  "passwords": {
    "demo": {
      "value": "hyperbook",
      "name": "Dokumentations-Demo",
      "description": "Öffnet die Demos zum Passwortschutz. Absichtlich veröffentlicht."
    }
  }
}
```

Wenn du keine Passwortliste führen möchtest, schreib das Passwort direkt in die
Seite:

```md
---
name: Demo geschützte Seite
protect:
  password: hyperbook
  description: Das Passwort ist der Name des Projekts.
---
```

## Wo diese Seite sonst noch fehlt

Suche in dieser Dokumentation nach **"Du bist drin"** — dem Satz oben auf
dieser Seite. Du wirst ihn nicht finden. Geschützte Seiten liefern nichts an
den Suchindex, der den vollen Text von allem speichert, was er aufnimmt.

Dasselbe gilt für `llms.txt` und für das Inhaltsverzeichnis: die Überschriften
dieser Seite stecken im verschlüsselten Inhalt, es gibt also nichts, woraus
sich ein Inhaltsverzeichnis bauen ließe.

## Weiter

Unter [Demo geschützter Abschnitt](/advanced/protect-section-demo) siehst du,
was passiert, wenn ein ganzer Ordner geschützt ist.
