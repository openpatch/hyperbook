---
name: Standalone Layout Demo
layout: standalone
hide: true
---

# Standalone Layout Demo

This page demonstrates the **standalone layout** feature, which displays only the content without any navigation, header, or footer elements.

## Purpose

The standalone layout is designed specifically for **iframe embedding**, allowing Hyperbook pages to be seamlessly integrated into other websites or applications.

## Key Features

- **Content Only**: No header, sidebar, navigation, or footer elements
- **Clean Presentation**: Perfect for embedding in external sites
- **Full Focus**: Readers see only the content without distractions
- **Easy Integration**: Works seamlessly in iframes

## How to Use

### Method 1: Page Frontmatter

Set the layout in your page's frontmatter:

```md
---
name: My Standalone Page
layout: standalone
---

# Your Content Here
```

### Method 2: URL Parameter (Recommended for iframes)

Add `?standalone=true` to any page URL:

```html
<iframe src="https://your-hyperbook.com/your-page?standalone=true"></iframe>
```

This method allows **any page** to be displayed in standalone mode without modifying its frontmatter.

## Example Usage

```html
<!-- Embed this page in standalone mode -->
<iframe 
  src="/advanced/standalone-layout-demo?standalone=true" 
  width="100%" 
  height="600px"
  frameborder="0">
</iframe>
```

## Use Cases

- **Course Management Systems**: Embed lessons directly in LMS platforms
- **Documentation Portals**: Include specific pages in larger documentation sites
- **Presentations**: Display content in presentation tools
- **Mobile Apps**: Show web content in embedded webviews
- **Widget Integration**: Include Hyperbook content as widgets

## What's Hidden in Standalone Mode?

When standalone layout is active, the following elements are hidden:

- Header with logo and navigation
- Sidebar navigation
- Previous/Next page buttons
- Footer metadata and links
- Search functionality
- Dark mode toggle

Only the main article content remains visible.

## Testing

View this page with the URL parameter to see standalone mode:
[This page with ?standalone=true](/advanced/standalone-layout-demo?standalone=true)
