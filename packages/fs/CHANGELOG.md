# @hyperbook/fs

## 0.8.1

### Patch Changes

- [`832678b`](https://github.com/openpatch/hyperbook/commit/832678b39f6a1a6e5cdd361c9c384d341762c09e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update packages

## 0.8.0

### Minor Changes

- [`511f497`](https://github.com/openpatch/hyperbook/commit/511f497e3e19c4294ddacb4e2b98cb47f35901d9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add single use templates. Every page can now be a template, where you can use all the helper functions defined in the snippets documentation (https://hyperbook.openpatch.org/elements/snippets#helpers). You only have to use the file extension `.md.hbs`.

### Patch Changes

- [`13bfad5`](https://github.com/openpatch/hyperbook/commit/13bfad58f5a16d2d54b4043ce855cf6c3bc397a0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix .md.hbs not in allowed file extensions.

## 0.7.5

### Patch Changes

- [`cf58c13`](https://github.com/openpatch/hyperbook/commit/cf58c13ca19aaba8e20e6e1cb27ab3ebbfb74d37) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

## 0.7.4

### Patch Changes

- [`e581f06`](https://github.com/openpatch/hyperbook/commit/e581f06ddb5291528d46ba8c797f5cf8f54072e1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug index not found when no other sibling directories are present.

## 0.7.3

### Patch Changes

- [`17ad5eb`](https://github.com/openpatch/hyperbook/commit/17ad5eb263ce6c45a04482483d2efa3fc1697f76) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix extension did not find the .git folder.

## 0.7.2

### Patch Changes

- [`c6414c8`](https://github.com/openpatch/hyperbook/commit/c6414c8e4c32ec96143a8da4fe8fb0e611ec8c7a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - When getting the markdown content of a vfile, an empty string will be returned and a waring will be display on the console. This should lead to a better experience, when developing a hyperbook.

## 0.7.1

### Patch Changes

- [`6fa6eba`](https://github.com/openpatch/hyperbook/commit/6fa6eba7b6753ed434c3aa94c713bb9486189c1a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix rbase and rfile including .git in the path, which lead to files not found.

## 0.7.0

### Minor Changes

- [`ff21264`](https://github.com/openpatch/hyperbook/commit/ff2126432223b7abefd44c711c42c915ab839d94) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add helpers for accesing the root of your project. rbase64 and rfile work find you .git directory and work from there. In contrast base64 and file work relative to your hyperbook. So rbase64 and rfile are helpful, when working in a mono-repo.

## 0.6.3

### Patch Changes

- [`6e3fcd5`](https://github.com/openpatch/hyperbook/commit/6e3fcd5616af81f41fb1ff412066f94660ea5cfd) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Remove console.log statement

## 0.6.2

### Patch Changes

- [`1614352`](https://github.com/openpatch/hyperbook/commit/16143528449b1bfd2d70ab781df66f945b14f3ea) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix hyperbook not buidling when an unsupported file is present in the book or glossary folder.

## 0.6.1

### Patch Changes

- [`e4712b2`](https://github.com/openpatch/hyperbook/commit/e4712b20601a96e8e6c2c748a3bd3c9719a6d523) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug when no repo is defined.

- [`cad9962`](https://github.com/openpatch/hyperbook/commit/cad99629cae32de462f1145b082f6cc11cbf3cb3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix pages not in navigation

## 0.6.0

### Minor Changes

- [`56a42f6`](https://github.com/openpatch/hyperbook/commit/56a42f6a4b67de082fc90b812a248c5b7e004c31) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add ability to extract lines based on a regex.

## 0.5.0

### Minor Changes

- [`b134e02`](https://github.com/openpatch/hyperbook/commit/b134e027db1b11cbd0a7e46858dfa60b93c05653) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add more helpers for templates and snippets. See documentation of snippets for more details.

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
