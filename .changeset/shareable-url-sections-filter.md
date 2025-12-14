---
"@hyperbook/markdown": minor
"hyperbook": minor
---

Add shareable URL builder with sections filter

- Added share button (🔗 icon) in header that opens a dialog for creating shareable URLs
- Implemented sections filter query parameter to show only specific content sections
- Added live URL preview with standalone mode toggle and section selection checkboxes
- QR code now includes all query parameters in the generated code
- TOC toggle hides automatically when sections are filtered
- Floating action buttons (TOC, QR code) now use dynamic flexbox positioning
- Both share and QR dialogs moved outside content area to remain visible when filtering
