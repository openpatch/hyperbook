---
name: Read-Along
permaid: readalong
---

# Read-Along

The read-along directive allows you to create interactive reading experiences where text is highlighted as audio plays. Users can follow along word-by-word and click on words to jump to specific parts of the audio.

## Modes

The directive supports two modes:

### Text-to-Speech (TTS) Mode

Use the browser's built-in text-to-speech engine to automatically generate audio:

```markdown
:::readalong{mode="tts"}
This text will be spoken by the browser's text-to-speech engine.
Each word will be highlighted as it is spoken.
:::
```

:::readalong{mode="tts"}
This is a demonstration using text-to-speech. The browser will read this text aloud and highlight each word as it speaks. Click on any word to jump to that part.
:::

### Manual Mode (Audio File)

Use a pre-recorded audio file with optional timestamps:

```markdown
:::readalong{src="/audio.mp3" autoGenerate="true"}
This is the text that will be synchronized with the audio.
You can include multiple sentences and paragraphs.
:::
```

:::readalong{src="/Free_Test_Data_1MB_MP3.mp3" autoGenerate="true" speed="120"}
This is a demonstration with an audio file. Each word will be highlighted as the audio plays. Click on any word to jump to that part of the audio. The synchronization is automatically generated based on reading speed.
:::

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | string | "manual" | Mode: "tts" for text-to-speech or "manual" for audio file |
| `src` | string | required (manual mode) | Path to the audio file (MP3, WAV, OGG, M4A) |
| `autoGenerate` | boolean | false | Enable automatic timestamp generation (manual mode) |
| `speed` | number | 150 | Reading speed in words per minute or TTS rate |
| `timestamps` | JSON | null | Manual timestamps array with `{word, start, end}` objects |

## With Manual Timestamps

If you have precise timestamps from tools like OpenAI Whisper, you can provide them as JSON:

```markdown
:::readalong{src="/audio.mp3" timestamps='[{"word":"Hello","start":0,"end":0.5},{"word":"world","start":0.5,"end":1.0}]'}
Hello world
:::
```

## Features

- **Play/Pause Control**: Interactive button to control audio playback
- **Word Highlighting**: Current word is highlighted with smooth animations
- **Click to Jump**: Click any word to seek to that timestamp
- **Auto-scroll**: Automatically scrolls to keep the current word visible
- **Time Display**: Shows current time and total duration
- **Theme Support**: Automatically adapts to light and dark modes

## Multiple Paragraphs

The directive supports multiple paragraphs and preserves formatting:

```markdown
:::readalong{src="/audio.mp3" autoGenerate="true"}
This is the first paragraph of your content.

This is the second paragraph.

And a third paragraph for good measure.
:::
```

## Tips

- Use `mode="tts"` for quick setup without audio files - the browser will read the text
- Use `autoGenerate="true"` with audio files for quick setup without manual timestamps
- Adjust `speed` to match the actual reading pace of your audio or TTS rate
- For best results with manual timestamps, ensure they match your text exactly
- Supported audio formats: MP3, WAV, OGG, M4A (any HTML5-compatible format)
- TTS mode works best in Chrome, Edge, and Safari browsers

:::alert{info}
**TTS Mode**: No audio file needed! The browser's text-to-speech engine will read your content automatically. Perfect for quick prototyping or accessibility features.
:::

:::alert{warn}
**Manual Mode**: An audio file is required. Make sure the audio path is correct and accessible.
:::
