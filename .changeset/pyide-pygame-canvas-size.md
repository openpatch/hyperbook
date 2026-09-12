---
"@hyperbook/markdown": patch
"hyperbook": patch
---

Fix `pyide`: a pygame script's canvas now takes the size from `pygame.display.set_mode`.

SDL draws into the canvas element at the surface's own pixel size, but nothing resized that
element, so it kept the HTML default of 300x150 and every frame was clipped to the top-left
corner of the game. The failure was quiet: pygame itself reported the requested size, so
`screen.get_size()` and `pygame.display.get_window_size()` both returned `(480, 360)` for a
`set_mode((480, 360))` whose right half and bottom two thirds were nowhere on screen.

`set_mode` now carries the surface size over to the canvas element, the way `screensize`
already does for the turtle. The backing store matches the surface pixel for pixel rather
than being scaled by the device pixel ratio, since SDL writes raw pixels into it.

Scripts that do not import pygame are untouched, turtle scripts included.
