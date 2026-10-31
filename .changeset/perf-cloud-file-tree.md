---
"@hyperbook/cloud": patch
---

Editor: the file tree no longer slows the editor down on large books. Toggling a folder or typing in the filter re-renders only the sidebar instead of the whole editor, tree rows are memoized, and the tree is built without repeated sibling scans. The tree is now virtualized, so only the rows near the viewport are in the DOM however big the book is, and the filter renders from a deferred value so typing stays responsive even with thousands of matches. Quick open's list is memoized the same way. Folders now start collapsed, so a large book opens quickly and stays clear until unfolded.
