---
name: Archive
permaid: archive
---

# Archive

All folders in the folder `archives` will be zipped when you build your
hyperbook. You can use the `archive` directive to add a download button for
these zipped folders. You only have to pass the folder name, everything else is
handled for you.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `name` | Folder name inside the `archives` directory | - |

```md
:archive[Project Template]{name="project-1"}
```

:archive[Project Template]{name="project-1"}

This is useful for providing project templates, solutions for a coding problem etc.

## Symbolic links

A symbolic link inside an archive folder is followed: the zip contains the files
it points to, not the link. That way an archive can share a folder with the book
without keeping a second copy, for example an `assets` folder next to a page:

```
archives/game/
  Main.java
  assets -> ../../book/chapter/assets
```

On Windows, Git checks symbolic links out as plain text files unless they are
enabled (`git config core.symlinks true`).
