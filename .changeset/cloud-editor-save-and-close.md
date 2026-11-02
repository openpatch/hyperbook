---
"@hyperbook/cloud": patch
---

"Save and close" in the editor no longer closes tabs whose save failed or ran into a conflict, so their unsaved changes are kept, and the conflict dialog it can lead to stays open instead of vanishing. "Close others" and "Close all" now close the tabs open when they are clicked, including one opened while the menu was showing. An unclosed container directive inside another one no longer folds over the closing `:::` of the outer one.
