---
name: Protect
permaid: protect
keywords:
  - password
  - encryption
---

# Protect

If you want to protect an area of your Hyperbook with a password, you
can use the protect-block.

The content is encrypted at build time with AES-256-GCM, using a key derived
from the password with PBKDF2. Neither the content nor the password is in the
built page — the browser decrypts it after the password is entered.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `password` | Password required to unlock the protected content | - |
| `use` | Key of a password from your [password registry](/configuration/passwords) | - |
| `description` | Description shown above the password input | - |
| `id` | Optional shared id for syncing multiple protected blocks | auto-generated |

```md
:::protect{password="hyperbook" description="The password is the name of this project."}

:smiley:

:::
```

:::protect{password="hyperbook" description="The password is the name of this project."}

:smiley:

:::

:::alert{info}
Be sure to use a higher number of `:` if you want to protect something which also uses `:`.
:::

You can sync protect-block by using the id property.

```md
:::protect{id="1" password="hyperbook" description="The password is the name of this project."}

:smiley:

:::

:::protect{id="1" password="hyperbook" description="The password is the name of this project."}

:apple:

:::
```

:::protect{id="1" password="hyperbook" description="The password is the name of this project."}

:smiley:

:::

:::protect{id="1" password="hyperbook" description="The password is the name of this project."}

:apple:

:::

## Named passwords

Instead of repeating a password everywhere it is used, put it in a
[password registry](/configuration/passwords) and refer to it by name. Then you
can change it in one place, and the registry file can stay out of your
repository.

```md
:::protect{use="chapter-3"}

The solution.

:::
```

Referring to a key that has no value anywhere fails the build, so a typo can
never silently publish your content behind an empty password. Run
`hyperbook passwords check` to see what is missing.

## Protecting a whole page or section

A `:::protect` block protects part of a page. To protect the whole thing, set
`protect` in the frontmatter of a [page](/configuration/page) or a
[section](/configuration/section) instead.

```md
---
name: Solutions
protect: chapter-3
---
```

On a section — a folder's `index.md` — every page and subsection inside
inherits it. Protected entries keep their place in the navigation and get a
lock next to their name, so readers can see that a page exists and that it
needs a password.

One password opens the whole section: the unlock is keyed on whichever page or
section declared the `protect`, so a reader enters it once and every page that
inherited it is open. A subsection that sets its own `protect` is its own
unlock, and stays closed.

The password for both demos below is `hyperbook`.

**[View Protected Page Demo →](/advanced/protect-page-demo)**

**[View Protected Section Demo →](/advanced/protect-section-demo)**

## Nesting

Protect blocks can be nested. The inner block is encrypted first, so the outer
password reveals only the outer content — the inner block still asks for its
own password.

```md
::::protect{use="students"}

Visible to the class.

:::protect{use="teachers"}

Visible only to teachers.

:::

::::
```

## What this does and does not protect

Protected content is left out of the search index and out of `llms.txt`, and
headings inside a protect block do not appear in the table of contents.

:::alert{warn}
The encrypted content is delivered to the browser, so anyone can try passwords
against it as fast as their computer allows. A short or guessable password is
not much protection. Use this to keep solutions out of a student's way, not to
protect anything genuinely sensitive.

Files linked from inside a protected block — images, downloads, archives — are
copied to the output as usual and stay reachable at their normal URL. Only the
HTML is encrypted.
:::

## Books opened without a web server

Decryption uses the browser's Web Crypto API, which is only available over
`https` or on `localhost`. A book opened directly from disk with a `file://`
URL cannot decrypt anything.

If you distribute your book as a folder, set `protect.mode` in your
`hyperbook.json` to `obfuscate`. The content and password are then embedded in
the page as they were before encryption existed — which hides the content from
a casual reader and from nobody else.

```json
{
  "protect": {
    "mode": "obfuscate"
  }
}
```

| Option | Description | Default |
|---|---|---|
| `mode` | `encrypt` or `obfuscate` | `encrypt` |
| `iterations` | PBKDF2 iterations. Higher is slower to unlock and slower to attack | `250000` |
| `passwordsFile` | Location of the password registry | `passwords.json` |
