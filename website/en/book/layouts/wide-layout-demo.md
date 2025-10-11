---
name: Wide Layout Demo
layout: wide
index: 10
---

# Wide Layout Demo

This page demonstrates the **wide layout** feature, which provides full-width content with navigation always available in drawer mode.

## Key Features of Wide Layout

The wide layout is ideal for pages that need maximum horizontal space:

- **Full-Width Content**: Content spans the entire page width with padding
- **Drawer-Only Navigation**: The sidebar is always hidden, and navigation is accessed via the hamburger menu
- **Responsive Design**: Works seamlessly on all screen sizes
- **Simple Configuration**: Just add `layout: wide` to your page frontmatter

## Usage

To use the wide layout, simply add the `layout` property to your page frontmatter:

```md
---
name: My Wide Page
layout: wide
---

# Your Content Here
```

## When to Use Wide Layout

Consider using the wide layout for:

- **Data Tables**: Pages with wide tables that need horizontal space
- **Code Examples**: Pages with long code snippets that benefit from wider display
- **Galleries**: Image galleries or visual content that needs full width
- **Interactive Content**: Pages with embedded interactive elements that need space
- **Presentations**: Content that works better in a presentation-like format

## Example: Wide Table

Here's a table that benefits from the wide layout's extra horizontal space:

| Feature | Default Layout | Wide Layout | Description |
|---------|---------------|-------------|-------------|
| Content Width | Limited by sidebar | Full width with padding | Wide layout provides more horizontal space |
| Navigation | Sidebar always visible on desktop | Always in drawer mode | Maximizes content area |
| Best For | Standard documentation | Tables, galleries, presentations | Choose based on content needs |
| Mobile Behavior | Uses drawer navigation | Uses drawer navigation | Consistent mobile experience |
| Configuration | `layout: default` or omit | `layout: wide` | Simple frontmatter option |

## Example: Code Block

```javascript
// Wide layout provides more horizontal space for code
function demonstrateWideLayout() {
  const features = ['full-width-content', 'drawer-navigation', 'responsive-design'];
  return features.map(feature => {
    console.log(`Wide layout feature: ${feature} - now you can see longer lines without scrolling!`);
    return feature;
  });
}
```

## Comparison

Switch between this page and other documentation pages to see the difference between default and wide layouts. Notice how the content area on this page extends to the full width of your browser window, while standard pages maintain a sidebar on desktop screens.

---

**Note**: You can switch back to the default layout at any time by removing the `layout` property or setting it to `default`.
