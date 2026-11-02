---
"@hyperbook/cloud": patch
---

The server refuses to start when `SMTP_FROM` contains no sender address (such as `SMTP_FROM=noreply`). Before, mail went out with an empty envelope sender and mail servers rejected it with "MAIL FROM <> does not match header From <MAILER-DAEMON>".
