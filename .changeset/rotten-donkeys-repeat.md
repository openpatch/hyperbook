---
"@hyperbook/markdown": patch
"hyperbook": patch
---

Fix several data-loss and corruption bugs in cloud sync:

- Loading from the cloud no longer fails whenever the server has events but no
  snapshot. The reconstruction the server builds from an event log alone
  carries a placeholder database version, which `import` rejected outright —
  so a user's work synced up but never came back down, silently, until
  something happened to post a full snapshot.
- The event watermark is now stored per hyperbook. Two hyperbooks served from
  the same origin shared one `localStorage` key, so each sent the other's
  `afterEventId` and got stuck in a permanent conflict loop.
- A sync conflict no longer discards local work. The client now pulls the
  server state, replays its pending events on top of it locally and remotely,
  and only then reloads.
- Offline batches now chain onto the watermark each one returns. Every batch
  after the first previously carried a watermark recorded before the flush and
  was rejected, discarding the whole queue.
- Events now carry their Dexie primary-key schema, so the server can replay
  onto a table it has no snapshot for without assuming the key field is `id`.
- Ephemeral `currentState` (cursor, scroll, window size) is no longer included
  in cloud snapshots; it was already excluded from events.
- A batch rejected with a 4xx is dropped instead of being retried forever, and
  a 404 from the cloud no longer throws a `TypeError` that looked transient.
- Concurrent `online` events can no longer start two overlapping queue flushes.
- Closing the tab now flushes pending changes with a `keepalive` request
  instead of only warning. Anything changed inside the debounce window was
  lost when the tab closed, and `beforeunload` never fires at all on mobile
  Safari or when a background tab is discarded.
