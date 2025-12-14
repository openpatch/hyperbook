---
name: Layouts
index: 8
---

# Page Layouts

Hyperbook provides three layout options to suit different content presentation needs. You can choose a layout by adding the `layout` property to your page's frontmatter.

## Available Layouts

### Default Layout

The standard layout with a visible sidebar on desktop screens. This is the default if no layout is specified.

**Features:**
- Sidebar navigation always visible on desktop
- Content area with optimal reading width
- Responsive design that switches to drawer navigation on mobile

**Usage:**
```md
---
name: My Page
layout: default
---
```

Or simply omit the `layout` property entirely.

**Best for:** Standard documentation pages, tutorials, and articles.

---

### Wide Layout

Full-width content with navigation always in drawer mode, providing maximum horizontal space.

**Features:**
- Content spans full width with padding
- Sidebar hidden on all screen sizes
- Navigation accessed via hamburger menu
- Ideal for content requiring horizontal space

**Usage:**
```md
---
name: My Wide Page
layout: wide
---
```

**Best for:**
- Data tables with many columns
- Long code examples
- Image galleries
- Interactive embedded content
- Presentation-style pages

**[View Wide Layout Demo →](/advanced/wide-layout-demo)**

---

### Standalone Layout

Content-only display with all navigation and UI elements hidden, perfect for iframe embedding.

**Features:**
- No header, sidebar, or footer elements
- Clean, distraction-free content
- Can be activated via frontmatter, URL parameter, or automatically when in iframe
- Designed for embedding in external sites
- Automatically hides TOC and QR code buttons

**Usage Method 1: Frontmatter**
```md
---
name: My Standalone Page
layout: standalone
---
```

**Usage Method 2: URL Parameter** (works on any page)
```html
<iframe src="https://your-hyperbook.com/any-page?standalone=true"></iframe>
```

**Usage Method 2a: Sections Filter** (filter specific content)

You can combine standalone mode with a `sections` parameter to show only specific sections by their header IDs:

```html
<iframe src="https://your-hyperbook.com/any-page?standalone=true&sections=aufgabe-1-ebene-in-koordinatenform"></iframe>
```

The `sections` parameter accepts:
- Single section ID: `sections=my-header-id`
- Multiple sections (comma-separated): `sections=section-1,section-2,section-3`

When a section is specified, only the header with that ID and all content until the next header of the same or higher level will be shown. Lower-level headers (subsections) are included automatically.

**Finding Header IDs**: Header IDs are automatically generated from the heading text by converting to lowercase and replacing spaces with hyphens. Special characters are removed. For example:
- `## My Section Title` → `my-section-title`
- `### Aufgabe 1: Ebene in Koordinatenform` → `aufgabe-1-ebene-in-koordinatenform`

You can also define custom IDs using the `{#custom-id}` syntax in your markdown: `## My Section {#custom-section-id}`

**Share Button**: Every page includes a share button (🔗 icon) in the header that opens a dialog to easily create shareable URLs with:
- Standalone mode toggle
- Section selection checkboxes (table of contents view)
- Live URL preview
- One-click copy to clipboard

**Usage Method 3: Automatic Detection** (iframe embedding)

When a Hyperbook page is embedded in an iframe, it automatically switches to standalone mode - no configuration needed! This provides seamless embedding without requiring URL parameters or frontmatter changes.

```html
<!-- Just embed any page - standalone mode activates automatically -->
<iframe src="https://your-hyperbook.com/any-page"></iframe>
```

The automatic detection ensures clean, distraction-free content for iframe embeds while maintaining full functionality when pages are accessed directly.

**Best for:**
- Learning Management System (LMS) integration
- Embedding in documentation portals
- Mobile app webviews
- Widget integration
- Presentations

**[View Standalone Layout Demo →](/advanced/standalone-layout-demo)**

**[View Sections Filter Demo →](/advanced/sections-filter-demo)**

---

## Configuration

The layout property is optional in your page frontmatter:

```md
---
name: Page Title
layout: wide  # or 'default', 'standalone'
---

# Your Content Here
```

## Layout Comparison

| Feature | Default | Wide | Standalone |
|---------|---------|------|------------|
| Sidebar Visibility | Visible on desktop | Always hidden | Always hidden |
| Content Width | Limited for readability | Full width | Full width |
| Navigation Access | Sidebar / Drawer | Drawer only | None (hidden) |
| Header | Visible | Visible | Hidden |
| Footer | Visible | Visible | Hidden |
| Best Use Case | Documentation | Tables, galleries | Iframe embedding |

---

## Tips

- **Default Layout**: Use for most documentation pages to maintain consistent navigation
- **Wide Layout**: Switch to wide when content needs horizontal space (tables, code, galleries)
- **Standalone Layout**: Use the URL parameter (`?standalone=true`) for flexible iframe embedding without modifying page source
- You can mix different layouts across pages in the same Hyperbook project
