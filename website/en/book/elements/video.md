---
name: Video
permaid: video
---

# Video

Video element to allow easy display of videos on Hyperbook via HTML's [_The Video Embed element_](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video).

The `<video>` tag is supported by all modern browsers, see [Browser compatibility](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video#browser_compatibility) for more detail.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `src` | URL or path to the video file | - |
| `title` | Video title shown below the player | - |
| `author` | Video author shown below the player | - |
| `poster` | Image shown before playback starts | - |

## Local file

```markdown
::video{src="/clouds.mp4" poster="/clouds.jpg" title="Morgenwolken" author="Natureclip (CC-BY 3.0)"}
```

::video{src="/clouds.mp4" poster="/clouds.jpg" title="Morgenwolken" author="Natureclip (CC-BY 3.0)"}

## Remote file

```markdown
::video{src="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" poster="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg" title="For Bigger Escape" author="By Google"}
```

::video{src="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" poster="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg" title="For Bigger Escape" author="By Google"}
