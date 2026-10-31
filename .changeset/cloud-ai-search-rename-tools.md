---
"@hyperbook/cloud": minor
---

The AI assistant gained two tools. `search_files` searches all the book's
text files (pending proposals included) with a regular expression and
reports matching lines as `path:line: text`, capped per request and per
search; binary and oversized files are skipped and reported. `rename_file`
moves a text file to a new path as one proposal change — the old path
deleted, the new one created with the same content — instead of a delete
plus a write. The system prompt now tells the model to search before
changing and to update links to a renamed file's old path in the same
request.
