---
name: Audio
permaid: audio
---

# Audio

The `audio` directive embeds an audio player with optional metadata and a thumbnail image.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `src` | URL or path to the audio file | - |
| `thumbnail` | URL or path to a thumbnail image | - |
| `title` | Title shown below the player | - |
| `author` | Author shown below the player | - |
| `position` | Position of the play button and thumbnail: `left` or `right` | `left` |

## Usage

```markdown
::audio{src="/Free_Test_Data_1MB_MP3.mp3" thumbnail="/group-people.png" title="Hallo" author="Max Mustermann"}

::audio{src="/Free_Test_Data_1MB_MP3.mp3" thumbnail="/group-people.png" title="Hallo" author="Max Mustermann" position="right"}

::audio{src="/Free_Test_Data_1MB_MP3.mp3" title="Hallo" author="Max Mustermann"}

::audio{src="/Free_Test_Data_1MB_MP3.mp3"}

::audio{src="/Free_Test_Data_1MB_MP3.mp3" position="right"}
```

::audio{src="/Free_Test_Data_1MB_MP3.mp3" thumbnail="/group-people.png" title="Hallo" author="Max Mustermann"}

::audio{src="/Free_Test_Data_1MB_MP3.mp3" thumbnail="/group-people.png" title="Hallo" author="Max Mustermann" position="right"}

::audio{src="/Free_Test_Data_1MB_MP3.mp3" title="Hallo" author="Max Mustermann"}

::audio{src="/Free_Test_Data_1MB_MP3.mp3"}

::audio{src="/Free_Test_Data_1MB_MP3.mp3" position="right"}
