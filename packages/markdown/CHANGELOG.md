# @hyperbook/markdown

## 0.4.0

### Minor Changes

- [`c526071`](https://github.com/openpatch/hyperbook/commit/c526071d11e9c248c933bade1ac1298a0fcbeefb) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add lightbox for images. You can now click on an image to display a larger preview.

### Patch Changes

- [`28b803e`](https://github.com/openpatch/hyperbook/commit/28b803efbeac6835afc0040b7f1fb03c210cc72d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix toc toggle misaligned bars on iPad

- [`42cf26c`](https://github.com/openpatch/hyperbook/commit/42cf26cacd32026fa95ab850c4d5e8f2b96b9c37) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix height on iOS

## 0.3.4

### Patch Changes

- Updated dependencies [[`8d53899`](https://github.com/openpatch/hyperbook/commit/8d538999fc924f7b3e3115416cba4978c9589b68)]:
  - @hyperbook/provider@0.2.0

## 0.3.3

### Patch Changes

- [`e526943`](https://github.com/openpatch/hyperbook/commit/e526943fec3ef91cfce853af6a0c5cdaf3f22eef) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Column headers of tables now have a margin in mobile view.

## 0.3.2

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.1.7

## 0.3.1

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.1.6

## 0.3.0

### Minor Changes

- [#338](https://github.com/openpatch/hyperbook/pull/338) [`774405b`](https://github.com/openpatch/hyperbook/commit/774405b936b10bf90e884ec7201cb38c734db8c3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - We now remove HTML comments from your Markdown files. The comments will be
  completely removed from the HTML output. So you can use these for adding hints
  for your co-authors, or removing a section of your book from the output, but
  not from the source code.

  HTML comments also work across multiple lines. Here you can see an example:

  ```md
  <!-- This is a HTML comment -->

  <!--
    It
    also
    works
    across
    multiple
    lines
  -->
  ```

## 0.2.0

### Minor Changes

- [#326](https://github.com/openpatch/hyperbook/pull/326) [`9472583`](https://github.com/openpatch/hyperbook/commit/947258359e33a39362c070f6c7128f214a79c4c5) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add configuration options to the hyperbook.json for the element bookmarks and excalidraw.

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.1.5

## 0.1.6

### Patch Changes

- Fix error when heading is empty. For example when writing a heading in our VS Code extension.

## 0.1.5

### Patch Changes

- Updated dependencies [[`cedb551`](https://github.com/openpatch/hyperbook/commit/cedb55191fd025b5a214df406a53cbab5d1b1bc1)]:
  - @hyperbook/provider@0.1.4

## 0.1.4

### Patch Changes

- Updated dependencies [[`c3e747a`](https://github.com/openpatch/hyperbook/commit/c3e747ab7b95c3e526b3800b169aa8f505f9b9a2)]:
  - @hyperbook/provider@0.1.3

## 0.1.3

### Patch Changes

- [`a7be20c`](https://github.com/openpatch/hyperbook/commit/a7be20c426ee96cefdc198e843b30eda32e96c75) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - remove react-icons

## 0.1.2

### Patch Changes

- Updated dependencies [[`2c34554`](https://github.com/openpatch/hyperbook/commit/2c34554f64359fb995190b1465daddfa3e0101c0)]:
  - @hyperbook/provider@0.1.2

## 0.1.1

### Patch Changes

- [`9ea5483`](https://github.com/openpatch/hyperbook/commit/9ea5483512fd5134f6823104a68fecea2c50cb00) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Force package update due to failed pipeline

- Updated dependencies [[`9ea5483`](https://github.com/openpatch/hyperbook/commit/9ea5483512fd5134f6823104a68fecea2c50cb00)]:
  - @hyperbook/provider@0.1.1

## 0.1.0

### Minor Changes

- [`6c1bd51`](https://github.com/openpatch/hyperbook/commit/6c1bd51e7ded1b2094ba590e5d8ddc5c0f6254b8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Extract feature in separate packages. This allows for easier development of new templates and allows enables to make changes more transparent.

### Patch Changes

- Updated dependencies [[`6c1bd51`](https://github.com/openpatch/hyperbook/commit/6c1bd51e7ded1b2094ba590e5d8ddc5c0f6254b8)]:
  - @hyperbook/provider@0.1.0
