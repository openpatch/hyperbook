---
"@hyperbook/markdown": patch
"hyperbook": patch
"@hyperbook/cloud": patch
---

Cloud sync fixes from a review. Work done before a student's first login is uploaded when nothing is saved yet, instead of being cleared (another student's data on the device is never uploaded). Two tabs logging in at once no longer clear each other's work. Rows the server refuses during an import or reset wait to be retried instead of being lost. After a session ends, changes keep being kept for upload until the same student logs in again. A full store answers 507 and the book says the saved work has reached its limit, instead of retrying with ever smaller requests; changes that do not make it larger still go through, and the limit counts bytes.
