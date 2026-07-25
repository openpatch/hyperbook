---
"@hyperbook/markdown": patch
"hyperbook": patch
---

**onlineide**: `libraries="scratch"` loads [Scratch for Java](https://scratch4j.openpatch.org) — `Stage`, `Sprite`, `AnimatedSprite`, `UISprite`, `Pen`, `Text`, `Camera`, `Timer` and the rest of the library, with the 841 bundled costumes and 266 sounds. Programs written against the desktop library run unchanged in the browser; the only differences are that there is no `import org.openpatch.scratch.*;`, because the Online IDE has no packages, and that the desktop-only parts (shaders, pixel buffer, recording, file system, Tiled maps, fullscreen) compile but report in the output that they do nothing.
