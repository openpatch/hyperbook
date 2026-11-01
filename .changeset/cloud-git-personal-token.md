---
"@hyperbook/cloud": patch
---

Git over HTTPS now also accepts a personal git token, not just a per-book one: create it under Your account → "Git tokens (all books)", then use username `git` and the token as the password for every book you may edit — handy for automation across many books, without giving each book its own token. Personal tokens are revocable at once and the push audit log records whether a per-book or a personal token was used. Per-book tokens stay as they are; the account password is deliberately not accepted for git. In English and German.
