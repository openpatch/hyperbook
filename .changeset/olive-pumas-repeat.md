---
"@hyperbook/markdown": patch
"hyperbook": patch
---

Improve the cloud sync indicator:

- Each sync state now has its own badge shape on the toolbar icon. Every state
  previously rendered the identical person glyph, distinguished only by fill
  color, so amber "unsynced" and green "synced" were indistinguishable to a
  red-green color blind reader.
- Sync states a reader can act on are now surfaced outside the user drawer.
  Being offline or failing to save was only visible in a drawer most readers
  never open. The notice offers a retry when a save fails, and says how much is
  waiting while offline. Successful saves stay silent.
- A sync conflict no longer reloads the page without warning. The merge is
  explained first, with a "Reload now" button, and the reload follows a few
  seconds later. Reloading is still necessary because directives read the store
  once at startup, but it is no longer a surprise.
- The toolbar button carries an accessible name that tracks the sync state, and
  the status line is an `aria-live` region, so a change is announced rather than
  only shown.
- The status line reports what it already knew but discarded: how long ago the
  last save landed, and how many batches are waiting while offline. "Saved
  locally" alone read as "you are all done".
- The toolbar icon no longer stops updating when the shell is rendered without
  the user drawer.
- Status colors meet WCAG AA contrast and follow the light/dark theme; they
  were fixed mid-tones at roughly 2-3:1 on white.
- `hyperbook.i18n.get` honors its fallback argument. Ten call sites in the
  cloud UI passed one, but the parameter did not exist, so a missing key
  rendered the raw key id.
- The impersonation banner offsets only the element after it, not every
  following sibling, and builds its markup as nodes instead of interpolating
  the username into `innerHTML`.
