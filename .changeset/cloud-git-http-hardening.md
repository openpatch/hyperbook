---
"@hyperbook/cloud": patch
---

Hardened the git smart HTTP endpoints and build bookkeeping. Gzip-encoded
request bodies are now accepted for clone/fetch (upload-pack) and push
(receive-pack); other content encodings are rejected with 415. Oversized
pushes are cut off mid-stream with a 413 and no longer crash the git service.
Concurrent pushes to the same book are serialized with the book lock, and
post-push accounting (source bytes, commit count, audit log, optional preview
build) now verifies the pushed commit is reachable from `main` instead of
comparing it to the branch head. The pre-receive hook is only rewritten when
it actually changed (atomic temp-file rename), and a failed git tag update or
build cleanup after a successful publish no longer marks the build as failed —
the problem is recorded as a warning in the build log instead.
