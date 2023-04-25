# @hyperbook/next-watch

## 0.2.3

### Patch Changes

- [`cf58c13`](https://github.com/openpatch/hyperbook/commit/cf58c13ca19aaba8e20e6e1cb27ab3ebbfb74d37) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

## 0.2.2

### Patch Changes

- [`e581f06`](https://github.com/openpatch/hyperbook/commit/e581f06ddb5291528d46ba8c797f5cf8f54072e1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug index not found when no other sibling directories are present.

## 0.2.1

### Patch Changes

- [`1a91dcb`](https://github.com/openpatch/hyperbook/commit/1a91dcb3d78f8567c8616e3239d6b771b71d874e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix dev server not starting. With the upgrade to NextJS 13 the parsing of conf property to the next function changed. At the moment we do not need the custom conf, but in the future we probably need to create next.config.js files.

## 0.2.0

### Minor Changes

- [`ac262ca`](https://github.com/openpatch/hyperbook/commit/ac262ca4a60b313dafbce33e5c0d753fd504f012) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Upgrade to NextJS 13

## 0.1.2

### Patch Changes

- [`50e5fc2`](https://github.com/openpatch/hyperbook/commit/50e5fc2ab3730bbded82b4b954dc2667724cb1ec) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - use workspace dependency

- Updated dependencies [[`104f2de`](https://github.com/openpatch/hyperbook/commit/104f2de6fa054ecadaf19811c5f8c3c560ca5a64)]:
  - @hyperbook/types@0.5.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`8d53899`](https://github.com/openpatch/hyperbook/commit/8d538999fc924f7b3e3115416cba4978c9589b68)]:
  - @hyperbook/types@0.4.0

## 0.1.0

### Minor Changes

- [#371](https://github.com/openpatch/hyperbook/pull/371) [`5a287b2`](https://github.com/openpatch/hyperbook/commit/5a287b25a24c027f65c7b2817f180c1ec395dff9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - # Introducing Hyperlibrary

  A Hyperlibrary is a way to connect multiple Hyperbooks and Hyperlibraries with
  each other. Hyperlibraries are a super flexible way to develop connected
  Hyperbooks.

  A Hyperlibrary is nothing more than a `hyperlibrary.json` files.
  Here is an example for connecting different versions.

  ```json
  {
    "name": "Versions",
    "library": [
      { "src": "v1", "name": "1.0.0", "basePath": "v1" },
      { "src": "v2", "name": "2.0.0", "basePath": "/" }
    ]
  }
  ```

  The folder structure in this case would look like this:

  ```bas
  documention
  | v1
  | | ...
  | | hyperbook.json
  | v2
  | | ...
  | | hyperbook.json
  | hyperlibrary.json
  ```

  As for a Hyperbook, you also have to run the `hyperbook setup` first.
  Afterwards you can use the `hyperbook build` command for building your
  Hyperlibrary.

  The `hyperbook dev` command is not supported with this release. As a workaround you have to start the Hyperbooks as standalones. For example

  ```bash
  user ~/documention $ cd v1
  user ~/v1 $ npx hyperbook dev
  ```

  # CLI Changes

  - `hyperbook setup` does not download the template any more from the GitHub repo, but bundles it. This should decrease bandwidth and improve setup speed.
  - `hyperbook build` and `hyperbook setup` received new command line outputs. This was necessary for not getting lost when using the CLI with a Hyperlibrary.

### Patch Changes

- Updated dependencies [[`5a287b2`](https://github.com/openpatch/hyperbook/commit/5a287b25a24c027f65c7b2817f180c1ec395dff9)]:
  - @hyperbook/types@0.3.0
