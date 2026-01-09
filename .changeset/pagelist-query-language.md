---
"@hyperbook/markdown": minor
"hyperbook": minor
---

Enhanced pagelist with powerful query language and improved Date handling.

**New Query Language Features:**
- Boolean operators: `AND`, `OR`, `NOT` for combining conditions
- Parentheses for grouping: `(condition1 OR condition2) AND condition3`
- Custom frontmatter field queries: `difficulty(beginner)`, `tags(tutorial)`
- Operator precedence: `NOT` > `AND` > `OR`

**New Parameters:**
- `limit`: Limit the number of results returned
- `orderBy`: Sort by any field including custom frontmatter (e.g., `date:desc`, `difficulty:asc`)

**Date Handling:**
- YAML date values without quotes (e.g., `date: 2025-01-09`) now work correctly for filtering and sorting
