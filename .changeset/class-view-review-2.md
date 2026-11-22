---
"hyperbook": patch
"@hyperbook/cloud": patch
---

More class view fixes. The publish warning also appears when some pages fail to render, leaving out only those pages, and says they were not checked. Tasks on glossary pages get columns. "Other" counts tasks, not saved rows (an IDE's files count once), and its dialog shows one entry per task. "Worked on" counts a task that appears on two pages once. A passing error reading a book's task list is no longer remembered until a restart. Logins in steady use are extended again (since the "online now" fix they only were after an hour's pause). The CSV keeps umlauts in its file name, and a refused download shows a message instead of saving the error as a file. The multievent docs recommend an `id` to keep saved answers.
