---
"@hyperbook/markdown": minor
"hyperbook": minor
---

**pyide**: Improve turtle and pytamaro support

- Add `Turtle()` constructor support for multiple simultaneous turtles
- Fix `write()` alignment — text no longer influences turtle position
- Add all standard turtle shapes: `arrow`, `turtle`, `classic`, `triangle`, `square`, `circle` (default: `classic`)
- Set default screen size to 640×480
- Add checkered transparency pattern to the canvas wrapper background
- Integrate `@raspberrypifoundation/python-friendly-error-messages` for clearer Python error output
- Fix `js_svg_graphic` FFI for pytamaro 2.0.1 compatibility (`show_graphic`, `save_graphic_svg`)
