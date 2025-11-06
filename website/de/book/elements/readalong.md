---
name: Read-Along
permaid: readalong
---

# Read-Along

Die Read-Along-Direktive ermöglicht es, interaktive Leseerlebnisse zu erstellen, bei denen der Text synchron zur Audiowiedergabe hervorgehoben wird. Benutzer können Wort für Wort folgen und auf Wörter klicken, um zu bestimmten Stellen im Audio zu springen.

## Grundlegende Verwendung

```markdown
:::readalong{src="/audio.mp3" autoGenerate="true"}
Dies ist der Text, der mit dem Audio synchronisiert wird.
Sie können mehrere Sätze und Absätze einschließen.
:::
```

:::readalong{src="/Free_Test_Data_1MB_MP3.mp3" autoGenerate="true" speed="120"}
Dies ist eine Demonstration der Read-Along-Funktion. Jedes Wort wird hervorgehoben, während das Audio abgespielt wird. Klicken Sie auf ein beliebiges Wort, um zu diesem Teil des Audios zu springen. Die Synchronisation wird automatisch basierend auf der Lesegeschwindigkeit generiert.
:::

## Mit manuellen Zeitstempeln

Wenn Sie präzise Zeitstempel von Tools wie OpenAI Whisper haben, können Sie diese als JSON angeben:

```markdown
:::readalong{src="/audio.mp3" timestamps='[{"word":"Hallo","start":0,"end":0.5},{"word":"Welt","start":0.5,"end":1.0}]'}
Hallo Welt
:::
```

## Konfigurationsoptionen

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|--------------|
| `src` | string | erforderlich | Pfad zur Audiodatei (MP3, WAV, OGG, M4A) |
| `autoGenerate` | boolean | false | Automatische Zeitstempelgenerierung aktivieren |
| `speed` | number | 150 | Lesegeschwindigkeit in Wörtern pro Minute (wenn autoGenerate true ist) |
| `timestamps` | JSON | null | Manuelle Zeitstempel-Array mit `{word, start, end}` Objekten |

## Funktionen

- **Play/Pause-Steuerung**: Interaktive Schaltfläche zur Steuerung der Audiowiedergabe
- **Wort-Hervorhebung**: Aktuelles Wort wird mit sanften Animationen hervorgehoben
- **Klicken zum Springen**: Klicken Sie auf ein Wort, um zu diesem Zeitstempel zu springen
- **Auto-Scroll**: Scrollt automatisch, um das aktuelle Wort sichtbar zu halten
- **Zeitanzeige**: Zeigt aktuelle Zeit und Gesamtdauer an
- **Theme-Unterstützung**: Passt sich automatisch an helle und dunkle Modi an

## Mehrere Absätze

Die Direktive unterstützt mehrere Absätze und behält die Formatierung bei:

```markdown
:::readalong{src="/audio.mp3" autoGenerate="true"}
Dies ist der erste Absatz Ihres Inhalts.

Dies ist der zweite Absatz.

Und ein dritter Absatz zur Veranschaulichung.
:::
```

## Tipps

- Verwenden Sie `autoGenerate="true"` für eine schnelle Einrichtung ohne manuelle Zeitstempel
- Passen Sie `speed` an das tatsächliche Lesetempo Ihres Audios an
- Für beste Ergebnisse mit manuellen Zeitstempeln stellen Sie sicher, dass diese genau mit Ihrem Text übereinstimmen
- Unterstützte Audioformate: MP3, WAV, OGG, M4A (jedes HTML5-kompatible Format)

:::alert{warn}
Die Read-Along-Direktive benötigt eine Audiodatei. Stellen Sie sicher, dass der Audiopfad korrekt und zugänglich ist.
:::
