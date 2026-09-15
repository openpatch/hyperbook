---
"@hyperbook/markdown": patch
hyperbook: patch
---

Fix importing JSON exports from older Dexie database versions. The manual import now passes `acceptVersionDiff` and `acceptMissingTables` (matching the cloud import path) and re-applies v6/v7 data migrations to imported rows.
