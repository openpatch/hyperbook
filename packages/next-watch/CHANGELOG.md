# @hyperbook/next-watch

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
