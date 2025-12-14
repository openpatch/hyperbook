---
name: Sections Filter Demo
hide: true
lang: en
---

# Sections Filter Demo

This page demonstrates the **sections filter** feature, which allows you to show only specific sections of a page using the `sections` query parameter.

## Section 1: Introduction

This is the first section. It contains introductory content.

### Subsection 1.1

This is a subsection of Section 1. When you filter by the parent section ID, this subsection is also included.

### Subsection 1.2

Another subsection with more details.

## Section 2: Features

This section describes the features of the sections filter.

### Key Benefits

- **Targeted Content**: Show only what's relevant
- **Flexible Embedding**: Mix and match sections
- **Automatic Subsections**: Lower-level headers are included

### Usage Examples

You can use this feature in various ways to create focused content views.

## Section 3: Examples

Here are some practical examples.

### Example 1

First example with detailed explanation.

### Example 2

Second example showing different use case.

## Section 4: Conclusion

This is the final section with concluding remarks.

---

## How to Use

To view specific sections, add the `sections` parameter to the URL:

- View only Section 1: `?sections=section-1-introduction`
- View only Section 2: `?sections=section-2-features`
- View multiple sections: `?sections=section-1-introduction,section-3-examples`

### Try It Out

- [View Section 1 only](/advanced/sections-filter-demo?standalone=true&sections=section-1-introduction)
- [View Section 2 only](/advanced/sections-filter-demo?standalone=true&sections=section-2-features)
- [View Sections 1 and 3](/advanced/sections-filter-demo?standalone=true&sections=section-1-introduction,section-3-examples)

### Embedding Example

```html
<!-- Embed only Section 2 -->
<iframe 
  src="/advanced/sections-filter-demo?standalone=true&sections=section-2-features" 
  width="100%" 
  height="400px"
  frameborder="0">
</iframe>
```
