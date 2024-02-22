---
name: Video
---

# Video

Video element to allow easy display of videos on Hyperbook via HTML's [_The Video Embed element_](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video).

The `<video>` tag is supported by all modern browsers, see [Browser compatibility](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video#browser_compatibility) for more detail.

The video element accepts these arguments:

- **src**: The URL of the video file to embed. Could be a local file path relative from your public directory, or a remote video URL.
- **title**: Video title (optional).
- **author**: The video's author (optional).
- **poster**: An image to be shown while the video is downloading, or until the user hits the play button. Could be a local file path relative from your public directory, or a remote image URL (optional).

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
