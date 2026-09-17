---
"@hyperbook/markdown": patch
hyperbook: patch
---

**pyide turtle**: `speed()` now animates like CPython's `turtle` module. Previously `speed()` set the inter-command delay to `300 / speed`, so the turtle jumped per command and only the pause between commands changed; `speed(10.2)` and `speed(10.4)` were indistinguishable from `speed(10)`, and `speed(11)` snapped to instant. Moves and turns are now split into sub-steps (hops) using CPython's formulas — `1 + int(distance / (3 * 1.1**speed * speed))` for moves and `1 + int(abs(angle) / (3 * speed))` for turns — so the line visibly crawls along its path and higher speeds draw in fewer, larger chunks. `delay()` / `tracer()` once again control the per-hop screen delay independently (default 10 ms, matching CPython), instead of being overwritten by `speed()`.
