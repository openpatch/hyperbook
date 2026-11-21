---
"@hyperbook/markdown": minor
"hyperbook": minor
---

Hyperbook Cloud sync is redesigned. Every change is marked on the device the moment it happens and uploaded row by row; the marks survive leaving the page, closing the tab and going offline, and the next page uploads what is left. Leaving a page no longer asks about unsaved changes, a page load no longer overwrites work that was not uploaded yet, and changes from another device no longer cause a merge and a forced reload. When two devices change the same row, the change made later wins, so a device that kept an old change offline no longer overwrites newer work. Several tabs of a book share their unsent changes and take turns uploading. Large backlogs are uploaded in batches, and a row the server refuses no longer holds up the others. Logging out uploads what is left and empties the device. Uploads over 8 KB are gzip-compressed. `hyperbook.cloud.sendSnapshot()` is replaced by `hyperbook.cloud.replaceAll()`.
