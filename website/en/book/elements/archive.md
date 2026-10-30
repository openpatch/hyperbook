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

| Attribute | Description                                                                                                                                                           | Default |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `name`    | Folder name inside the `archives` directory                                                                                                                           | -       |
| `include` | Comma-separated list of `src=dest` pairs that are added to the zip. `src` is a file or folder inside the book (starting with `/`), `dest` is its path inside the zip. | -       |

```md
:archive[Project Template]{name="project-1"}
```

:archive[Project Template]{name="project-1"}

This is useful for providing project templates, solutions for a coding problem etc.

## Includes

With `include` you can pull additional files or folders into the zip when the
book is built — without copying them into `archives/`. A book can therefore
share one folder between a page and an archive:

```md
:archive[Project: Workshop]{name="workshop" include="/book/projects/workshop/assets=assets"}
```

This zips the folder `archives/workshop/` and adds the folder
`book/projects/workshop/assets` under the name `assets` inside the zip.
Several pairs can be given, separated by commas:

```md
:archive[Project: Workshop]{name="workshop" include="/book/projects/workshop/assets=assets,/public/README.md=docs/README.md"}
```

The rules:

- `src` starts with `/` and is resolved against the book root. It can be a file
  or a folder; a folder is added recursively, including dotfiles. It must stay
  inside the book.
- `dest` is the path inside the zip. It is relative and must not contain `..`.
- A missing `src`, or a `dest` that already exists in the archive, fails the
  build with an error naming the page that declared the include.

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

Symbolic links only survive with a build from the unpacked folder. Hyperbook
Cloud accepts books as zip uploads, and a zip upload cannot carry symbolic
links — the platform leaves such entries out. Use the `include` attribute
instead: it adds the same files to the zip at build time and is portable
everywhere.
