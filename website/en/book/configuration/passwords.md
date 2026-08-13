---
name: Passwords
index: 5
permaid: passwords
keywords:
  - password
  - protect
---

# Passwords

A [protect](/elements/protect) block can carry its password inline. That works,
but it means the password is written into your markdown, repeated everywhere it
is used, and committed with the rest of the book.

The alternative is a registry: one file that maps a name to a password. Blocks,
pages and sections then refer to the name.

```json
{
  "$schema": "https://hyperbook.openpatch.org/schemas/passwords.schema.json",
  "passwords": {
    "chapter-3": {
      "value": "kepler",
      "description": "Chapter 3 solutions"
    }
  }
}
```

```md
:::protect{use="chapter-3"}

The solution.

:::
```

The short form works too, when you do not need a description:

```json
{
  "passwords": {
    "chapter-3": "kepler"
  }
}
```

:::alert{warn}
`passwords.json` holds your actual passwords. Add it to your `.gitignore` if
your book is public, and supply the values from the environment when you build.
Books created with `create-hyperbook` ignore it already.

This documentation is the exception: its registry is committed, because the one
password in it is meant to be public so the demos work. Do not take it as the
example to follow.
:::

The demos it opens:

**[Protected Page Demo →](/advanced/protect-page-demo)**

**[Protected Section Demo →](/advanced/protect-section-demo)**

## Where the values come from

Hyperbook reads the registry from these places, in order. Later ones win.

| Source | Description |
|---|---|
| `passwords.json` | In the book folder, next to `hyperbook.json`. A missing file is fine |
| `HYPERBOOK_PASSWORDS_FILE` | Path to a registry file somewhere else |
| `HYPERBOOK_PASSWORDS` | The registry as JSON, directly in the variable |
| `HYPERBOOK_PASSWORD_<KEY>` | A single password. `chapter-3` becomes `HYPERBOOK_PASSWORD_CHAPTER_3` |

So you can keep the file out of your repository and set the passwords in your
CI instead:

```sh
HYPERBOOK_PASSWORD_CHAPTER_3=kepler hyperbook build
```

Or hand over the whole registry at once:

```sh
HYPERBOOK_PASSWORDS='{"passwords":{"chapter-3":"kepler"}}' hyperbook build
```

To keep the file somewhere else, point at it in your `hyperbook.json`:

```json
{
  "protect": {
    "passwordsFile": "../secrets/passwords.json"
  }
}
```

## Missing passwords stop the build

If a `use` refers to a name with no value anywhere, `hyperbook build` fails and
tells you which file and line to look at. It does not fall back to an empty
password — that would encrypt your content behind a key everyone can guess.

## The passwords command

`hyperbook passwords` shows what a book uses, without putting any of it into
the built site.

### list

```sh
hyperbook passwords list
```

```
KEY        PASSWORD  SOURCE  WHERE            LOCATION            DESCRIPTION
chapter-3  kepler    file    section          solutions/index.md  Chapter 3 solutions
chapter-3  kepler    file    page, inherited  solutions/one.md    Chapter 3 solutions
chapter-3  kepler    file    registry                             Chapter 3 solutions
```

| Option | Description |
|---|---|
| `--json` | Output as JSON |
| `--type <types>` | Only `registry`, `section`, `page` or `block` entries |
| `--filter <regex>` | Only entries matching a pattern |

### init

```sh
hyperbook passwords init --generate
```

Scans the book for every name that is referenced, and writes a registry
containing them. `--generate` fills in random passwords.

Existing values are kept — running it again after adding a new protected page
only adds the new name. `--force` replaces values that are already set.

### check

```sh
hyperbook passwords check
```

Exits with an error if any referenced name has no value, and names the file and
line that uses it. Run it in CI before `hyperbook build`.

It also warns, without failing, about names nothing uses and about two names
sharing the same password — the second usually means rotating one silently
leaves the other open.

## Listing passwords inside the book

The [passwordlist](/elements/passwordlist) directive puts the same information
on a page. Read the warning there first: it prints passwords into the built
site.
