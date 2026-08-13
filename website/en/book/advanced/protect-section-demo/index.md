---
name: Protected Section Demo
lang: en
protect:
  password: hyperbook
  description: The password is the name of this project.
---

# Protected Section Demo

This is a section — a folder with an `index.md`. Its frontmatter sets
`protect`, and everything in the folder inherits it.

Look at the navigation: both this section and the
[page inside it](/advanced/protect-section-demo/inherited) carry a lock, even
though that page says nothing about passwords in its own frontmatter.

## The frontmatter behind this section

This one uses the object form rather than a registry name, to show both ways:

```md
---
name: Protected Section Demo
protect:
  password: hyperbook
  description: The password is the name of this project.
---
```

## How far it reaches

Inheritance goes all the way down: pages, subsections, and pages inside those
subsections. A page or subsection that sets its own `protect` keeps it, and
protection is not additive — readers of a nested section need only the nested
password, not both.

```
book/
└── solutions/
    ├── index.md        protect: chapter-3
    ├── one.md          inherits chapter-3
    └── extra/
        ├── index.md    protect: extra-credit   ← overrides
        └── two.md      inherits extra-credit
```

## An overview page for yourself

A protected section is a good place for a
[passwordlist](/elements/passwordlist) — everything this documentation uses,
behind the password you just entered:

::passwordlist

Each password appears once for the registry entry, and once for every place it
is used.
