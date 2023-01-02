# @hyperbook/fs

## 0.4.0

### Minor Changes

- [`0c58ad8`](https://github.com/openpatch/hyperbook/commit/0c58ad80c3c8b145868d2c0303d42478ec0a9978) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Implement use a virtual file system. This allow for an abstraction layer, which enables us to implement a template system.

- [`0c58ad8`](https://github.com/openpatch/hyperbook/commit/0c58ad80c3c8b145868d2c0303d42478ec0a9978) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add templates to Hyperbook. Templates allow for resuing a layout. See the documentation for more details.

## 0.3.0

### Minor Changes

- [`9298af0`](https://github.com/openpatch/hyperbook/commit/9298af040b16836c632e234f6ccbb61d67e1246d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add the snippet element. Snippets are helpful for making the handling of repeated blocks easiert. For example you can define a protect-block, which uses the same password across your hyperbook in a snippet. If you want to change the password, you can just change it in the snippet. See the documentation for snippets to get a more in detail view on snippets.

## 0.2.0

### Minor Changes

- [`104f2de`](https://github.com/openpatch/hyperbook/commit/104f2de6fa054ecadaf19811c5f8c3c560ca5a64) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Repo can now be configured. So you can customize the label of the edit button on a page and you can insert the current path anywhere in the link, by using "%path%" placeholder.

## 0.1.3

### Patch Changes

- [`40ec0fd`](https://github.com/openpatch/hyperbook/commit/40ec0fde2cbb2ef823bf11be2b2db365f8c37d9c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Empty section index pages now correctly link to the first non-empty subpage.

## 0.1.2

### Patch Changes

- [`af4964b`](https://github.com/openpatch/hyperbook/commit/af4964b7c1c12134a1d08f74d387e8b42844b4a5) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix hyperbook not building when glossary folder is not present.

## 0.1.1

### Patch Changes

- [`f906c50`](https://github.com/openpatch/hyperbook/commit/f906c5075ec26263f90fabfa2a8ad556619c86da) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - We fixed links to pages on a glossary page are not relative to book, but relative to the root of the hyperbook, which caused unresolved links.

## 0.1.0

### Minor Changes

- [#392](https://github.com/openpatch/hyperbook/pull/392) [`8d53899`](https://github.com/openpatch/hyperbook/commit/8d538999fc924f7b3e3115416cba4978c9589b68) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Extract core funcationality from platfrom web into separate packages. This helps us to support more platforms.
