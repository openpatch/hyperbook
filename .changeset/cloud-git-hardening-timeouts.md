---
"@hyperbook/cloud": patch
---

Further hardening of the git smart HTTP endpoints and storage accounting.
Git child processes (upload-pack/receive-pack and the post-push `git gc`) are
killed after `GIT_OP_TIMEOUT_SECONDS` (default 300) and answered with 504, so
a stuck operation cannot hold a process forever. Per-book git traffic that
exceeds the operation limit now gets a 429 with `Retry-After` instead of a
401, and anonymous auth probes — every git client sends one to get the
challenge — no longer count as failed logins; the failure limiter is also
bounded (10k keys, expired entries swept, oldest evicted) since its keys are
attacker-chosen. The pre-receive hook now also rejects pushes whose whole
repository — including the quarantined pack of the push itself — exceeds the
book's storage quota, and a `git gc --prune=now` after each successful push
reclaims objects of deleted files. Reusing an already-publishing build with a
new note keeps that note, and the publish-note plumbing no longer drops it.
