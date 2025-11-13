---
name: Read-Along
permaid: readalong
---

# Read-Along

Die Read-Along-Direktive ermöglicht es, interaktive Leseerlebnisse zu erstellen, bei denen der Text synchron zur Audiowiedergabe hervorgehoben wird. Benutzer können Wort für Wort folgen und auf Wörter klicken, um zu bestimmten Stellen im Audio zu springen.

## Modi

Die Direktive unterstützt zwei Modi:

### Text-zu-Sprache (TTS) Modus

Verwenden Sie die integrierte Text-zu-Sprache-Engine des Browsers, um automatisch Audio zu generieren:

```markdown
:::readalong{mode="tts"}
Dieser Text wird von der Text-zu-Sprache-Engine des Browsers gesprochen.
Jedes Wort wird hervorgehoben, während es gesprochen wird.
:::
```

:::readalong{mode="tts"}
Dies ist eine Demonstration mit Text-zu-Sprache. Der Browser wird diesen Text vorlesen und jedes Wort hervorheben, während er spricht. Klicken Sie auf ein beliebiges Wort, um zu diesem Teil zu springen.
:::

### Manueller Modus (Audiodatei)

Verwenden Sie eine vorab aufgenommene Audiodatei mit optionalen Zeitstempeln:

```markdown
:::readalong{src="/audio.mp3" autoGenerate="true"}
Dies ist der Text, der mit dem Audio synchronisiert wird.
Sie können mehrere Sätze und Absätze einschließen.
:::
```

:::readalong{src="/Free_Test_Data_1MB_MP3.mp3" autoGenerate="true" speed="120"}
Dies ist eine Demonstration mit einer Audiodatei. Jedes Wort wird hervorgehoben, während das Audio abgespielt wird. Klicken Sie auf ein beliebiges Wort, um zu diesem Teil des Audios zu springen. Die Synchronisation wird automatisch basierend auf der Lesegeschwindigkeit generiert.
:::

## Konfigurationsoptionen

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|--------------|
| `mode` | string | "manual" | Modus: "tts" für Text-zu-Sprache oder "manual" für Audiodatei |
| `src` | string | erforderlich (manueller Modus) | Pfad zur Audiodatei (MP3, WAV, OGG, M4A) |
| `autoGenerate` | boolean | false | Automatische Zeitstempelgenerierung aktivieren (manueller Modus) |
| `speed` | number | 150 | Lesegeschwindigkeit in Wörtern pro Minute oder TTS-Rate |
| `timestamps` | JSON | null | Manuelle Zeitstempel-Array mit `{word, start, end}` Objekten |

## Mit manuellen Zeitstempeln

Wenn Sie präzise Zeitstempel von Tools wie OpenAI Whisper haben, können Sie diese als JSON angeben:

```markdown
:::readalong{src="/audio.mp3" timestamps='[{"word":"Hallo","start":0,"end":0.5},{"word":"Welt","start":0.5,"end":1.0}]'}
Hallo Welt
:::
```

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

- Verwenden Sie `mode="tts"` für eine schnelle Einrichtung ohne Audiodateien - der Browser liest den Text vor
- Verwenden Sie `autoGenerate="true"` mit Audiodateien für eine schnelle Einrichtung ohne manuelle Zeitstempel
- Passen Sie `speed` an das tatsächliche Lesetempo Ihres Audios oder die TTS-Rate an
- Für beste Ergebnisse mit manuellen Zeitstempeln stellen Sie sicher, dass diese genau mit Ihrem Text übereinstimmen
- Unterstützte Audioformate: MP3, WAV, OGG, M4A (jedes HTML5-kompatible Format)
- TTS-Modus funktioniert am besten in Chrome, Edge und Safari-Browsern

:::alert{info}
**TTS-Modus**: Keine Audiodatei erforderlich! Die Text-zu-Sprache-Engine des Browsers liest Ihren Inhalt automatisch vor. Perfekt für schnelles Prototyping oder Barrierefreiheitsfunktionen.
:::

:::alert{warn}
**Manueller Modus**: Eine Audiodatei ist erforderlich. Stellen Sie sicher, dass der Audiopfad korrekt und zugänglich ist.
:::
