---
"@hyperbook/cloud": patch
---

Fix event replay corrupting the state it reconstructs:

- The primary key is now parsed out of the Dexie schema string. Taking the
  first field verbatim left the markers on (`++id`, `&email`, `*tags`), so the
  key matched no row property at all and every update and delete missed
  silently while creates piled up duplicates. Compound keys (`[a+b]`) and
  outbound keys are handled too.
- A created row can no longer end up without its primary key, which made it
  unreachable to every later event.
- Primary keys keep their type. `prim_key` stored `String(primKey)`, flattening
  numeric and compound keys so they no longer matched the rows they addressed;
  events now also carry `prim_key_json`.
- Replay is idempotent. `create` appended unconditionally, so a retried or
  replayed batch duplicated rows; it now upserts.
- Dexie's dotted update paths (`update(id, {"state.zoom": 2})`) are applied to
  the nested field instead of being written as a literal `"state.zoom"`
  property.
- Events carry the client's Dexie primary-key schema, so a table with no prior
  snapshot is no longer assumed to be keyed by `id`. Tables keyed by something
  else — `bookmarks` by `path`, `onlineide` by `scriptId` — had a bogus `id`
  stamped onto every row.
- The `afterEventId` check and the append now share one transaction. Two
  clients writing at the same moment could both pass the check and interleave.
- A malformed batch is rejected with 400 instead of failing a CHECK constraint
  and returning 500, which the client treated as transient and retried forever.

Both new columns are added by migration; existing databases keep working.
