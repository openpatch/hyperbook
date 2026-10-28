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

## Was gespeichert wird

Nach der Anmeldung wird alles, was die interaktiven Elemente des Buchs speichern (Code-Editoren, Lesezeichen, Zeichnungen, Antworten, …), in Hyperbook Cloud gesichert:

- **Geräteübergreifend**: Schülerinnen und Schüler machen auf jedem Gerät dort weiter, wo sie aufgehört haben.
- **Offline**: Änderungen ohne Verbindung bleiben erhalten und werden gespeichert, sobald die Verbindung zurück ist.
- **Speicheranzeige**: Ein Symbol in der Werkzeugleiste zeigt, ob alles gespeichert ist. Jeder Zustand hat eine eigene Form, ist also nicht nur an der Farbe zu erkennen, und der Knopf nennt den Zustand für Screenreader.
- **Hinweise**: Zustände, bei denen man etwas tun kann (fehlgeschlagenes Speichern, offline, Zusammenführung mit einer anderen Sitzung), erscheinen als Hinweis unten auf der Seite, wo sinnvoll mit einem Knopf zum erneuten Versuchen. Erfolgreiches Speichern bleibt still.

Während man angemeldet ist, sind die Knöpfe für lokalen Export, Import und Zurücksetzen ausgeblendet, damit sie nicht mit dem gespeicherten Stand kollidieren.

Flüchtige Zustände der Oberfläche (Cursorposition, Scrollposition, Fenstergröße) werden nicht gespeichert: Sie gehören zu einem Gerät.

## Wie gespeichert wird

Hyperbook Cloud speichert Änderungen, nicht den ganzen Speicher:

1. **Änderungen werden festgehalten**, sobald sie passieren: jedes Anlegen, Ändern und Löschen in der lokalen Datenbank des Buchs, bei Änderungen nur die geänderten Felder.
2. **Sie werden gebündelt gesendet**, nach 2 Sekunden ohne Änderung (oder spätestens alle 10 Sekunden).
3. **Der Server fasst sie zusammen** zu einem Schnappschuss, nach 100 Änderungen.
4. **Beim Laden** wird der Stand aus dem Schnappschuss und den Änderungen danach wiederhergestellt.

Ein Bündel über 512 KB (zum Beispiel große Zeichnungen) wird stattdessen als vollständiger Schnappschuss gesendet.

### Zwei Geräte gleichzeitig

Jedes Speichern nennt den letzten Stand, den das Gerät kannte. Hat ein anderes Gerät dazwischen gespeichert, lehnt der Server ab, und das Gerät

1. lädt den aktuellen Stand,
2. wendet seine eigenen ungespeicherten Änderungen darauf an, lokal und auf dem Server,
3. erklärt die Zusammenführung in einem Hinweis und lädt die Seite neu, damit die Elemente den zusammengeführten Stand zeigen. Der Hinweis bietet **Jetzt neu laden** an.

Bei einer Zusammenführung geht nichts verloren. Der Server prüft und speichert in einem Schritt, sodass nicht zwei Geräte im selben Moment beide durchkommen.

### Offline und Verlassen der Seite

Änderungen ohne Verbindung warten in einer Warteschlange und werden der Reihe nach gesendet, sobald die Verbindung zurück ist; hat ein anderes Gerät inzwischen gespeichert, werden sie wie oben zusammengeführt. Die Warteschlange fasst höchstens 100 Bündel; darüber hinaus wird ein Schnappschuss gesendet.

Wird die Seite geschlossen, während noch Änderungen warten, werden sie mit einer Anfrage gesendet, die die Seite überdauert. Bündel über 60 KB lassen sich so nicht senden; dann ist die Nachfrage des Browsers nach ungespeicherten Änderungen das Zeichen, kurz zu warten.

## Hyperbook Cloud betreiben

Hyperbook Cloud liegt in `platforms/cloud/` des Hyperbook-Repositorys und läuft als ein einzelner Docker-Container. Installation und Betrieb beschreibt die [Cloud-README](https://github.com/openpatch/hyperbook/tree/main/platforms/cloud).
