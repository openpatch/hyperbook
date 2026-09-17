---
"@hyperbook/markdown": patch
hyperbook: patch
---

**pyide turtle**: `speed()` now animates like CPython's `turtle` module.

Previously `speed()` set the inter-command delay to `300 / speed`, so the turtle jumped a whole
command at a time and only the pause between commands changed; `speed(10.2)` and `speed(10.4)` were
indistinguishable from `speed(10)`, and `speed(11)` snapped to instant. Moves and turns are now
split into sub-steps (hops) using CPython's formulas — `1 + int(distance / (3 * 1.1**speed * speed))`
for moves and `1 + int(abs(angle) / (3 * speed))` for turns — so the line visibly crawls along its
path and higher speeds draw in fewer, larger chunks. `delay()` / `tracer()` once again control the
per-hop screen delay independently (default 10 ms, matching CPython), instead of being overwritten
by `speed()`.

As in CPython, the hops are transient: they animate the cursor and stretch a throwaway line from the
start of the move, and only the move's endpoint becomes permanent geometry. Subdivision is also
skipped entirely when `speed(0)` is set or `tracer()` is anything other than 1, matching CPython's
`if self._speed and screen._tracing == 1` guard.

`setheading()` (and `home()`, which uses it) now folds the turn into `[-180, 180)` before rotating,
so it always takes the short way round — `left(270)` followed by `setheading(0)` turns 90° counter-
clockwise, not 270° clockwise. `left()` / `right()` still sweep the raw angle they were given, so
`left(360)` animates a full revolution.

Because the default delay drops from 80 ms to CPython's 10 ms, existing books will draw noticeably
faster at the default `speed(3)` for short moves, while long moves keep a comparable overall pace.
