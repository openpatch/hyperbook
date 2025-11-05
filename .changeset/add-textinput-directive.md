---
"@hyperbook/markdown": minor
hyperbook: minor
"hyperbook-studio": minor
---

Add new textinput directive for persistent text input with Dexie store integration

This adds a new `::textinput` markdown directive that creates interactive text input areas with automatic persistence to the browser's Dexie database.

Features:
- Customizable placeholder and height attributes
- Automatic save with debouncing for performance
- Multiple independent inputs via custom IDs
- Full light and dark mode support
- Responsive design with error handling
