---
"@hyperbook/markdown": minor
"hyperbook": patch
---

Replace JavaScript-dependent UI elements with native HTML for better accessibility and no-JS support

This major update converts collapsibles, navigation sections, and tabs to use native HTML elements, making core functionality work without JavaScript while maintaining progressive enhancement for state persistence and synchronization.

**Navigation & Collapsibles:**
- Navigation sections use native `<details>` and `<summary>` elements
- Collapsible directive uses native HTML details/summary
- Empty sections styled with italic text to indicate non-clickable headers
- JavaScript provides progressive enhancement: state persistence and multi-element sync

**Tabs Directive:**
- Converted to CSS-only tabs using hidden radio buttons and labels
- Works completely without JavaScript using native HTML form controls
- JavaScript adds state persistence and multi-instance synchronization
- Active tab indicator using `:has()` CSS selector
- Supports up to 10 tabs per group
- Multiple tab groups with same ID sync across the page when JavaScript is enabled

**Progressive No-JS Support:**
- Hide JavaScript-dependent UI elements when JS is disabled (search, share, QR, export/import/reset buttons)
- Add `no-js` class to HTML element, removed immediately when JavaScript loads
- All core content navigation and interaction works without JavaScript
- Better SEO as all content is visible to search engines

**Accessibility Improvements:**
- Native HTML elements provide better keyboard navigation
- Screen reader friendly with proper ARIA semantics
- Browser-native focus management
- Reduced complexity and improved compatibility
