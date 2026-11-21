---
name: Cloud [Alpha]
index: 3
lang: de
---

# Cloud [Alpha]

:::alert{warn}

Diese Funktion befindet sich noch in der Alpha-Phase. Sie ist möglicherweise fehlerhaft und unterliegt Änderungen. Bitte teste sie und teile dein Feedback mit uns!

:::

Hyperbook Cloud ist eine selbst gehostete Plattform für Lehrkräfte. Sie veröffentlicht Bücher, gibt Schülerinnen und Schülern anonyme Zugänge und speichert, was sie in den interaktiven Elementen eines Buchs tun, damit sie auf jedem Gerät weitermachen können.

## Bücher auf Hyperbook Cloud

Wenn du dein Buch auf Hyperbook Cloud hochlädst, musst du nichts einstellen. Die Plattform baut dein Buch und verbindet es mit sich selbst: Im Buch erscheint ein Anmelde-Knopf, und die gedruckten QR-Codes melden Schülerinnen und Schüler direkt an.

Ein Buch auf Hyperbook Cloud kann **öffentlich** sein (alle können es lesen, Schülerinnen und Schüler melden sich an, um ihre Arbeit zu speichern) oder **privat** (nur seine Schülerinnen und Schüler können es lesen; alle anderen werden zuerst um eine Anmeldung gebeten).

## Bücher, die woanders liegen

Ein Buch auf GitHub Pages oder einem anderen Webspace kann Hyperbook Cloud trotzdem für Schülerzugänge nutzen. Lege das Buch in Hyperbook Cloud an, markiere es als „woanders gehostet“ mit seiner Adresse und ergänze die Eigenschaft `cloud` in deiner `hyperbook.json`:

```json
{
  "name": "Mein Hyperbook",
  "cloud": {
    "url": "https://physik.example.page",
    "id": "physik"
  }
}
```

| Eigenschaft | Beschreibung |
|---|---|
| `url` | Die Adresse des Buchs auf Hyperbook Cloud, wie sie auf seiner Seite dort steht. |
| `id` | Der Adressname des Buchs auf Hyperbook Cloud (der erste Teil von `url`). |

Hyperbook Cloud nimmt nur Anfragen von der Adresse an, die du für das Buch eingetragen hast. Das Buch muss also dort laufen.

## Anmelden

Schülerinnen und Schüler melden sich mit Benutzername und Passwort von ihrer Zugangskarte an oder scannen deren QR-Code. Das Anmeldeformular hat die Option **gemeinsam genutztes Gerät**: Dann endet die Anmeldung, wenn der Browser geschlossen wird. Sonst gilt eine Anmeldung 30 Tage.

Lehrkräfte können die Arbeit einer Schülerin oder eines Schülers in Hyperbook Cloud mit **View as student** öffnen. Das Buch zeigt dann ein Banner mit dem Namen und speichert nichts.

## Was Lehrkräfte sehen

Die Anmeldeseite sagt den Schülerinnen und Schülern, dass ihre Arbeit in ihrem Zugang gespeichert wird und ihre Lehrkraft sie sehen kann.

In Hyperbook Cloud zeigt der Reiter **Übersicht** einer Gruppe, was jede Schülerin und jeder Schüler in der veröffentlichten Version des Buchs bearbeitet hat:

- Eine Spalte pro Seite mit der Zahl der bearbeiteten Aufgaben. Ein Klick auf eine Seite öffnet eine Spalte pro Aufgabe, ein Klick auf einen gefüllten Kreis zeigt die Antwort (Text, Code, eine Melodie, ein abgehakter Punkt einer Checkliste, …).
- Zunächst erscheinen nur Seiten, auf denen jemand aus der Gruppe gearbeitet hat. Eine Auswahl beschränkt die Übersicht auf einen Abschnitt. Beides wird pro Gruppe gemerkt.
- Ein Punkt markiert, wer in den letzten zwei Minuten im Buch war. Die Übersicht aktualisiert sich alle 30 Sekunden.
- **Andere** zeigt Arbeit, die zu keiner Aufgabe der veröffentlichten Version gehört.
- **Als CSV herunterladen** exportiert, was gerade zu sehen ist, mit Benutzernamen und Zeiten.

Aufgaben sind Texteingaben, die Code-Editoren und IDEs, Struktogramme, Learningmaps, Zeichnungen, JMP, Bitflow, GeoGebra, H5P, Multievent, ABC-Editoren und Punkte von Checklisten.

### Arbeit behalten, wenn eine Aufgabe geändert wird

Die gespeicherte Arbeit einer Aufgabe wird über ihre id gefunden. Ohne `id` ergibt sich die id aus dem Inhalt der Aufgabe: Wird die Aufgabe geändert (auch nur ein Tippfehler), bekommt sie eine neue id. Das Buch zeigt die früheren Antworten dann nicht mehr, sie erscheinen unter **Andere**. Vor dem Veröffentlichen listet Hyperbook Cloud die betroffenen Aufgaben mit Arbeit von Schülerinnen und Schülern und ihre alten ids auf. Mit der alten id behält eine geänderte Aufgabe die Arbeit, zum Beispiel:

```md
::textinput{id="a1b2c3d4"}
```

Wichtige Aufgaben bekommen am besten von Anfang an eine `id`.

## Was gespeichert wird

Nach der Anmeldung wird alles, was die interaktiven Elemente des Buchs speichern (Code-Editoren, Lesezeichen, Zeichnungen, Antworten, …), in Hyperbook Cloud gesichert:

- **Geräteübergreifend**: Schülerinnen und Schüler machen auf jedem Gerät dort weiter, wo sie aufgehört haben.
- **Offline**: Änderungen ohne Verbindung bleiben erhalten und werden gespeichert, sobald die Verbindung zurück ist.
- **Speicheranzeige**: Ein Symbol in der Werkzeugleiste zeigt, ob alles gespeichert ist. Jeder Zustand hat eine eigene Form, ist also nicht nur an der Farbe zu erkennen, und der Knopf nennt den Zustand für Screenreader.
- **Hinweise**: Zustände, bei denen man etwas tun kann (fehlgeschlagenes Speichern, offline, Arbeit von einem anderen Gerät), erscheinen als Hinweis unten auf der Seite, wo sinnvoll mit einem Knopf zum erneuten Versuchen oder Neuladen. Erfolgreiches Speichern bleibt still.

Während man angemeldet ist, sind die Knöpfe für lokalen Export, Import und Zurücksetzen ausgeblendet, damit sie nicht mit dem gespeicherten Stand kollidieren.

Flüchtige Zustände der Oberfläche (Cursorposition, Scrollposition, Fenstergröße) werden nicht gespeichert: Sie gehören zu einem Gerät.

## Wie gespeichert wird

Maßgeblich ist die lokale Datenbank des Buchs; Hyperbook Cloud hält eine Kopie davon, Zeile für Zeile.

1. **Jede Änderung wird sofort markiert**, auf dem Gerät, als „noch nicht hochgeladen“. Die Markierung übersteht das Verlassen der Seite, das Schließen des Tabs und den Verlust der Verbindung.
2. **Markierte Zeilen werden hochgeladen**, nach 1 Sekunde ohne Änderung (oder spätestens alle 5 Sekunden), wenn der Tab in den Hintergrund geht und wenn die nächste Seite lädt. Ein Upload sendet den aktuellen Wert jeder markierten Zeile; die Markierung verschwindet, sobald der Server ihn hat. Viele markierte Zeilen werden in mehreren Anfragen hochgeladen. Eine Zeile, die der Server ablehnt (etwa weil sie zu groß ist), wird zurückgestellt und als Speicherfehler angezeigt; die anderen Zeilen werden trotzdem hochgeladen, und die Zeile wird erneut versucht, wenn sie sich ändert oder auf **Erneut versuchen** geklickt wird.
3. **Jeder Upload erhöht die Revision** der Schülerin oder des Schülers. Ein Gerät merkt sich die zuletzt gesehene Revision und übernimmt bei jedem Seitenaufruf und Upload nur die Zeilen, die andere Geräte danach hochgeladen haben.

Uploads über 8 KB werden mit gzip komprimiert; Code, Zeichnungen und andere Zustände von Elementen werden dadurch meist 3- bis 10-mal kleiner.

Eine Zeile zweimal zu senden schadet nicht, also gibt es nichts aufzulösen: Beim Verlassen einer Seite kommt nie eine Nachfrage, und kein Speichern wird als veraltet abgelehnt.

### Mehrere Geräte

Ändern zwei Geräte dieselbe Zeile (dieselbe Antwort, dieselbe Zeichnung), gilt die spätere Änderung, nach der Uhr des jeweiligen Geräts, egal wie spät das andere Gerät seine Änderung hochlädt. Ein Schulrechner, der eine Änderung eine Woche lang behalten hat, überschreibt nicht, was zu Hause seitdem entstanden ist; er übernimmt stattdessen die neuere Arbeit. Ein Gerät überschreibt nie eine Zeile, die es noch nicht hochgeladen hat, mit einer von einem anderen Gerät.

Mehrere Tabs des Buchs auf einem Gerät teilen sich ihre Markierungen und laden nacheinander hoch.

Arbeit von einem anderen Gerät, die ankommt, während eine Seite offen ist, landet sofort in der lokalen Datenbank. Die Elemente zeigen sie nach einem Neuladen: sofort, wenn auf der Seite noch nichts geändert wurde, sonst bietet ein Hinweis **Jetzt neu laden** an.

Meldet sich jemand zum ersten Mal auf einem Gerät an, oder meldet sich jemand anderes darauf an, werden die lokalen Daten des Geräts durch die gespeicherte Arbeit ersetzt. Beim Abmelden wird hochgeladen, was noch fehlt, und das Gerät geleert; ließ sich etwas nicht hochladen, fragt das Buch vorher nach.

### Offline und Verlassen der Seite

Änderungen ohne Verbindung bleiben markiert und werden hochgeladen, sobald die Verbindung zurück ist, auch wenn dazwischen Seiten gewechselt oder der Browser geschlossen wurde. Geht eine Seite in den Hintergrund, werden markierte Zeilen zusätzlich mit einer Anfrage gesendet, die die Seite überdauert (bis 60 KB); die Markierungen bleiben, bis ein späterer Upload sie bestätigt.

## Hyperbook Cloud betreiben

Hyperbook Cloud liegt in `platforms/cloud/` des Hyperbook-Repositorys und läuft als ein einzelner Docker-Container. Installation und Betrieb beschreibt die [Cloud-README](https://github.com/openpatch/hyperbook/tree/main/platforms/cloud).

Hyperbook Cloud wurde mit Unterstützung von KI entwickelt: Claude Opus 5.5 von Anthropic und GLM 5.3 von Z.ai, ausgeführt in Mistral Vibe.
