---
name: Read-Along
permaid: readalong
---

# Read-Along

The read-along directive allows you to create interactive reading experiences where text is highlighted as audio plays. Users can follow along word-by-word and click on words to jump to specific parts of the audio.

## Basic Usage

```markdown
:::readalong{src="/audio.mp3" autoGenerate="true"}
This is the text that will be synchronized with the audio.
You can include multiple sentences and paragraphs.
:::
```

:::readalong{src="/Free_Test_Data_1MB_MP3.mp3" autoGenerate="true" speed="120"}
This is a demonstration of the read-along feature. Each word will be highlighted as the audio plays. Click on any word to jump to that part of the audio. The synchronization is automatically generated based on reading speed.
:::

## With Manual Timestamps

If you have precise timestamps from tools like OpenAI Whisper, you can provide them as JSON:

```markdown
:::readalong{src="/audio.mp3" timestamps='[{"word":"Hello","start":0,"end":0.5},{"word":"world","start":0.5,"end":1.0}]'}
Hello world
:::
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `src` | string | required | Path to the audio file (MP3, WAV, OGG, M4A) |
| `autoGenerate` | boolean | false | Enable automatic timestamp generation |
| `speed` | number | 150 | Reading speed in words per minute (when autoGenerate is true) |
| `timestamps` | JSON | null | Manual timestamps array with `{word, start, end}` objects |

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

- Use `autoGenerate="true"` for quick setup without manual timestamps
- Adjust `speed` to match the actual reading pace of your audio
- For best results with manual timestamps, ensure they match your text exactly
- Supported audio formats: MP3, WAV, OGG, M4A (any HTML5-compatible format)

:::alert{warn}
The read-along directive requires an audio file. Make sure the audio path is correct and accessible.
:::
