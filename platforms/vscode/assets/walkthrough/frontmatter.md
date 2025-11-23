# Customize Page Frontmatter

Each page can have frontmatter - metadata at the top of the file that controls how the page appears and behaves.

## Example frontmatter:
```yaml
---
name: My Page Title
index: 1
permaid: my-page
---
```

## Available options:
- **name** - The title shown in navigation
- **permaid** - Custom URL slug for the page "/@/my-page"
- **index** - Order in navigation (lower numbers appear first)
- **hide** - Set to true to hide from navigation

Other options are available in the [documentation](https://hyperbook.openpatch.org/configuration/page).

## Try it:
1. Open any page in your book
2. Add frontmatter at the very top
3. Set a custom name and index
4. Save and check the preview to see the changes
