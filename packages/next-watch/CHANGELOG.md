# @hyperbook/next-watch

## 0.5.1

### Patch Changes

- [`bfa3016`](https://github.com/openpatch/hyperbook/commit/bfa30169bf2e6377385c6a1adb5aa625db7d1b68) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug with remark

- [`e84275a`](https://github.com/openpatch/hyperbook/commit/e84275a11949e455be4a00742528541b969d52f1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

## 0.5.0

### Minor Changes

- [`9bb80bb`](https://github.com/openpatch/hyperbook/commit/9bb80bbd711a2ec11d84f2263c581d42e92fd7de) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Move to pure ESM packages

### Patch Changes

- Updated dependencies [[`9bb80bb`](https://github.com/openpatch/hyperbook/commit/9bb80bbd711a2ec11d84f2263c581d42e92fd7de)]:
  - @hyperbook/types@0.7.0

## 0.4.1

### Patch Changes

- [`c6c7d1f`](https://github.com/openpatch/hyperbook/commit/c6c7d1f3dda16879166398916792025545e344ea) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix unified package wrong export error

- [`9851b21`](https://github.com/openpatch/hyperbook/commit/9851b21db8d19c849110eca623bfc450c76e06b9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - bundle unified to handle wrong import

## 0.4.0

### Minor Changes

- [`ff0e867`](https://github.com/openpatch/hyperbook/commit/ff0e86788d967194d442026b49d23082960c66da) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve the build of hyperbooks and the generation of the toc.

## 0.3.0

### Minor Changes

- [`f98c89e`](https://github.com/openpatch/hyperbook/commit/f98c89ed582a155d5b005ec72a04ae2619c35c47) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add element embed. This elements allow embedding content like GeoGebra Applets, LearningApps etc.

### Patch Changes

- [`832678b`](https://github.com/openpatch/hyperbook/commit/832678b39f6a1a6e5cdd361c9c384d341762c09e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update packages

- Updated dependencies [[`832678b`](https://github.com/openpatch/hyperbook/commit/832678b39f6a1a6e5cdd361c9c384d341762c09e)]:
  - @hyperbook/types@0.6.1

## 0.2.4

### Patch Changes

- Updated dependencies [[`4221fe1`](https://github.com/openpatch/hyperbook/commit/4221fe145a6dfffd9f97459fa2d2694da4b5d78e)]:
  - @hyperbook/types@0.6.0

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
