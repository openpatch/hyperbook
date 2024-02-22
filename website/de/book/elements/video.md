---
name: Video
lang: de
---

# Video

Das Video-Element erlaubt das Anzeigen eines Videos im Hyperbook als [_Video Embed element_](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video).

Der `<video>` tag wird von allen moderen Browsern akzeptiert. Siehe [Browser compatibility](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video#browser_compatibility) für mehr Details.

Das Video-Element akzeptiert verschiedene Parameter:

- **src**: Die URL der Videodatei. Entweder ein lokaler Pfad oder eine externe URL.
- **title**: Videotitel (optional).
- **author**: Autor des Videos (optional).
- **poster**: Ein Pfad zu einem Bild, welches während des Downloads oder bis der Play-Button gedrückt wird, angezeigt wird.

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
