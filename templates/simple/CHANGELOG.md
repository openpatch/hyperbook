# hyperbook-simple-template

## 0.7.1

### Patch Changes

- [`b799b7c`](https://github.com/openpatch/hyperbook/commit/b799b7c26710ee1fc5e59551bb710768829d68cf) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix repo links include full local directory

## 0.7.0

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

- Updated dependencies []:
  - @hyperbook/provider@0.1.7
  - @hyperbook/element-alert@0.1.7
  - @hyperbook/element-bitflow@0.1.8
  - @hyperbook/element-bookmarks@0.2.2
  - @hyperbook/element-collapsible@0.2.3
  - @hyperbook/element-dl@0.1.7
  - @hyperbook/element-excalidraw@0.2.2
  - @hyperbook/element-mermaid@0.1.7
  - @hyperbook/element-protect@0.2.2
  - @hyperbook/element-qr@0.1.8
  - @hyperbook/element-struktog@0.1.7
  - @hyperbook/element-tabs@0.1.8
  - @hyperbook/element-term@0.1.7
  - @hyperbook/element-youtube@0.1.7
  - @hyperbook/markdown@0.3.2
  - @hyperbook/styles@0.1.7

## 0.6.0

### Minor Changes

- [#363](https://github.com/openpatch/hyperbook/pull/363) [`5ca2ccf`](https://github.com/openpatch/hyperbook/commit/5ca2ccfec72a841ec9c4e43a03ceb2be68710541) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add custom links support. Custom links can now be configured in your `hyperbook.json`. See the book configuration documentation for more information on how to set them up.

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.1.6
  - @hyperbook/element-alert@0.1.6
  - @hyperbook/element-bitflow@0.1.7
  - @hyperbook/element-bookmarks@0.2.1
  - @hyperbook/element-collapsible@0.2.2
  - @hyperbook/element-dl@0.1.6
  - @hyperbook/element-excalidraw@0.2.1
  - @hyperbook/element-mermaid@0.1.6
  - @hyperbook/element-protect@0.2.1
  - @hyperbook/element-qr@0.1.7
  - @hyperbook/element-struktog@0.1.6
  - @hyperbook/element-tabs@0.1.7
  - @hyperbook/element-term@0.1.6
  - @hyperbook/element-youtube@0.1.6
  - @hyperbook/markdown@0.3.1
  - @hyperbook/styles@0.1.6

## 0.5.2

### Patch Changes

- Updated dependencies [[`2574ee6`](https://github.com/openpatch/hyperbook/commit/2574ee6f0f4c70b1f05a70bbd8b1d5ba0eba013f)]:
  - @hyperbook/element-protect@0.2.0

## 0.5.1

### Patch Changes

- Updated dependencies [[`69e76ae`](https://github.com/openpatch/hyperbook/commit/69e76aec46f3b83ecd4dc9e7e5fceb0fe7fb8148)]:
  - @hyperbook/element-collapsible@0.2.1

## 0.5.0

### Minor Changes

- [#341](https://github.com/openpatch/hyperbook/pull/341) [`b1d976c`](https://github.com/openpatch/hyperbook/commit/b1d976cfcad7d9be760c595d23becc48187d641e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The sections can now be opened and closed. The active page will always
  start opened. For each section you can overwrite the default expanded
  state by adding `expanded: true` to the frontmatter of the section.

### Patch Changes

- Updated dependencies [[`b1d976c`](https://github.com/openpatch/hyperbook/commit/b1d976cfcad7d9be760c595d23becc48187d641e)]:
  - @hyperbook/element-collapsible@0.2.0

## 0.4.1

### Patch Changes

- Updated dependencies [[`774405b`](https://github.com/openpatch/hyperbook/commit/774405b936b10bf90e884ec7201cb38c734db8c3)]:
  - @hyperbook/markdown@0.3.0

## 0.4.0

### Minor Changes

- [#326](https://github.com/openpatch/hyperbook/pull/326) [`9472583`](https://github.com/openpatch/hyperbook/commit/947258359e33a39362c070f6c7128f214a79c4c5) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add configuration options to the hyperbook.json for the element bookmarks and excalidraw.

### Patch Changes

- Updated dependencies [[`9472583`](https://github.com/openpatch/hyperbook/commit/947258359e33a39362c070f6c7128f214a79c4c5)]:
  - @hyperbook/element-bookmarks@0.2.0
  - @hyperbook/element-excalidraw@0.2.0
  - @hyperbook/markdown@0.2.0
  - @hyperbook/provider@0.1.5
  - @hyperbook/element-alert@0.1.5
  - @hyperbook/element-bitflow@0.1.6
  - @hyperbook/element-collapsible@0.1.5
  - @hyperbook/element-dl@0.1.5
  - @hyperbook/element-mermaid@0.1.5
  - @hyperbook/element-protect@0.1.5
  - @hyperbook/element-qr@0.1.6
  - @hyperbook/element-struktog@0.1.5
  - @hyperbook/element-tabs@0.1.6
  - @hyperbook/element-term@0.1.5
  - @hyperbook/element-youtube@0.1.5
  - @hyperbook/styles@0.1.5

## 0.3.9

### Patch Changes

- Updated dependencies []:
  - @hyperbook/element-tabs@0.1.5

## 0.3.8

### Patch Changes

- Updated dependencies []:
  - @hyperbook/markdown@0.1.6

## 0.3.7

### Patch Changes

- [#316](https://github.com/openpatch/hyperbook/pull/316) [`cedb551`](https://github.com/openpatch/hyperbook/commit/cedb55191fd025b5a214df406a53cbab5d1b1bc1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Extract Hyperbook types into a separate package

- Updated dependencies [[`cedb551`](https://github.com/openpatch/hyperbook/commit/cedb55191fd025b5a214df406a53cbab5d1b1bc1)]:
  - @hyperbook/provider@0.1.4
  - @hyperbook/element-alert@0.1.4
  - @hyperbook/element-bitflow@0.1.5
  - @hyperbook/element-bookmarks@0.1.4
  - @hyperbook/element-collapsible@0.1.4
  - @hyperbook/element-dl@0.1.4
  - @hyperbook/element-excalidraw@0.1.4
  - @hyperbook/element-mermaid@0.1.4
  - @hyperbook/element-protect@0.1.4
  - @hyperbook/element-qr@0.1.5
  - @hyperbook/element-struktog@0.1.4
  - @hyperbook/element-tabs@0.1.4
  - @hyperbook/element-term@0.1.4
  - @hyperbook/element-youtube@0.1.4
  - @hyperbook/markdown@0.1.5
  - @hyperbook/styles@0.1.4

## 0.3.6

### Patch Changes

- [`c3e747a`](https://github.com/openpatch/hyperbook/commit/c3e747ab7b95c3e526b3800b169aa8f505f9b9a2) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Do not rely on process.env.NODE_ENV and use env prodivded by the provider.

- Updated dependencies [[`9b2b71b`](https://github.com/openpatch/hyperbook/commit/9b2b71b8bbd728294ff4c4c97502e58e99619300), [`c3e747a`](https://github.com/openpatch/hyperbook/commit/c3e747ab7b95c3e526b3800b169aa8f505f9b9a2)]:
  - @hyperbook/element-qr@0.1.4
  - @hyperbook/element-excalidraw@0.1.3
  - @hyperbook/provider@0.1.3
  - @hyperbook/element-alert@0.1.3
  - @hyperbook/element-bitflow@0.1.4
  - @hyperbook/element-bookmarks@0.1.3
  - @hyperbook/element-collapsible@0.1.3
  - @hyperbook/element-dl@0.1.3
  - @hyperbook/element-mermaid@0.1.3
  - @hyperbook/element-protect@0.1.3
  - @hyperbook/element-struktog@0.1.3
  - @hyperbook/element-tabs@0.1.3
  - @hyperbook/element-term@0.1.3
  - @hyperbook/element-youtube@0.1.3
  - @hyperbook/markdown@0.1.4
  - @hyperbook/styles@0.1.3

## 0.3.5

### Patch Changes

- Updated dependencies [[`a7be20c`](https://github.com/openpatch/hyperbook/commit/a7be20c426ee96cefdc198e843b30eda32e96c75)]:
  - @hyperbook/markdown@0.1.3

## 0.3.4

### Patch Changes

- [`2459c34`](https://github.com/openpatch/hyperbook/commit/2459c343e89f890c10132cfb36bb466b5800133d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - use default import to be compatible with commonjs

- Updated dependencies [[`2459c34`](https://github.com/openpatch/hyperbook/commit/2459c343e89f890c10132cfb36bb466b5800133d)]:
  - @hyperbook/element-bitflow@0.1.3
  - @hyperbook/element-qr@0.1.3

## 0.3.3

### Patch Changes

- [`2c34554`](https://github.com/openpatch/hyperbook/commit/2c34554f64359fb995190b1465daddfa3e0101c0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - try to overcome issues with @redux/toolkit not supporting esm modules the way nextjs likes it.

- Updated dependencies [[`2c34554`](https://github.com/openpatch/hyperbook/commit/2c34554f64359fb995190b1465daddfa3e0101c0)]:
  - @hyperbook/element-collapsible@0.1.2
  - @hyperbook/element-protect@0.1.2
  - @hyperbook/element-tabs@0.1.2
  - @hyperbook/provider@0.1.2
  - @hyperbook/store@0.1.2
  - @hyperbook/element-alert@0.1.2
  - @hyperbook/element-bitflow@0.1.2
  - @hyperbook/element-bookmarks@0.1.2
  - @hyperbook/element-dl@0.1.2
  - @hyperbook/element-excalidraw@0.1.2
  - @hyperbook/element-mermaid@0.1.2
  - @hyperbook/element-qr@0.1.2
  - @hyperbook/element-struktog@0.1.2
  - @hyperbook/element-term@0.1.2
  - @hyperbook/element-youtube@0.1.2
  - @hyperbook/markdown@0.1.2
  - @hyperbook/styles@0.1.2

## 0.3.2

### Patch Changes

- [`f1dc99b`](https://github.com/openpatch/hyperbook/commit/f1dc99b785da1ff8079ad3881ba7eb354c3b2ec0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Tag templates as well

## 0.3.1

### Patch Changes

- [`9ea5483`](https://github.com/openpatch/hyperbook/commit/9ea5483512fd5134f6823104a68fecea2c50cb00) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Force package update due to failed pipeline

- Updated dependencies [[`9ea5483`](https://github.com/openpatch/hyperbook/commit/9ea5483512fd5134f6823104a68fecea2c50cb00)]:
  - @hyperbook/element-alert@0.1.1
  - @hyperbook/element-bitflow@0.1.1
  - @hyperbook/element-bookmarks@0.1.1
  - @hyperbook/element-collapsible@0.1.1
  - @hyperbook/element-excalidraw@0.1.1
  - @hyperbook/element-mermaid@0.1.1
  - @hyperbook/element-protect@0.1.1
  - @hyperbook/element-qr@0.1.1
  - @hyperbook/element-struktog@0.1.1
  - @hyperbook/element-tabs@0.1.1
  - @hyperbook/element-term@0.1.1
  - @hyperbook/element-youtube@0.1.1
  - @hyperbook/markdown@0.1.1
  - @hyperbook/provider@0.1.1
  - @hyperbook/store@0.1.1
  - @hyperbook/styles@0.1.1
  - @hyperbook/element-dl@0.1.1

## 0.3.0

### Minor Changes

- [`09af0c5`](https://github.com/openpatch/hyperbook/commit/09af0c5bee8fc95f04138a660e4a7c2e0e963f17) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - rename download element to dl, since npm does not allow download in the package name.

### Patch Changes

- Updated dependencies [[`09af0c5`](https://github.com/openpatch/hyperbook/commit/09af0c5bee8fc95f04138a660e4a7c2e0e963f17)]:
  - @hyperbook/element-dl@0.1.0

## 0.2.0

### Minor Changes

- [`6c1bd51`](https://github.com/openpatch/hyperbook/commit/6c1bd51e7ded1b2094ba590e5d8ddc5c0f6254b8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Extract feature in separate packages. This allows for easier development of new templates and allows enables to make changes more transparent.

### Patch Changes

- Updated dependencies [[`6c1bd51`](https://github.com/openpatch/hyperbook/commit/6c1bd51e7ded1b2094ba590e5d8ddc5c0f6254b8)]:
  - @hyperbook/element-alert@0.1.0
  - @hyperbook/element-bitflow@0.1.0
  - @hyperbook/element-bookmarks@0.1.0
  - @hyperbook/element-collapsible@0.1.0
  - @hyperbook/element-dl0.1.0
  - @hyperbook/element-excalidraw@0.1.0
  - @hyperbook/element-mermaid@0.1.0
  - @hyperbook/element-protect@0.1.0
  - @hyperbook/element-qr@0.1.0
  - @hyperbook/element-struktog@0.1.0
  - @hyperbook/element-tabs@0.1.0
  - @hyperbook/element-term@0.1.0
  - @hyperbook/element-youtube@0.1.0
  - @hyperbook/markdown@0.1.0
  - @hyperbook/provider@0.1.0
  - @hyperbook/store@0.1.0
  - @hyperbook/styles@0.1.0

## 0.1.1

### Patch Changes

- [`0325b9d`](https://github.com/openpatch/hyperbook/commit/0325b9ddce534f7133ff355ca0dbf1f8ddb08437) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Remove unused imports
