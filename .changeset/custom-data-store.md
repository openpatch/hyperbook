---
"@hyperbook/markdown": minor
"hyperbook": minor
"hyperbook-studio": minor
---

Add custom data table to Dexie store for user-managed state persistence

This adds a new `custom` table to the Hyperbook Dexie store, enabling users to persist arbitrary JSON data in the browser's IndexedDB.

Features:
- New `custom` table with schema `id, payload` for storing user-defined data
- Comprehensive documentation in the advanced section showing how to use the API
- Automatic inclusion in existing export/import functionality
- Full support for storing and retrieving JSON data using `store.custom.put()` and `store.custom.get()`
