# @hyperbook/markdown

## 0.10.1

### Patch Changes

- [`5588011`](https://github.com/openpatch/hyperbook/commit/5588011c3819816de125a3bea3513f8539f650f8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix submenu not staying open on page reload

## 0.10.0

### Minor Changes

- [#882](https://github.com/openpatch/hyperbook/pull/882) [`26ae87e`](https://github.com/openpatch/hyperbook/commit/26ae87e19b01b6c2f45590ade4d681c5a27c932a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The release is a complete rewrite of the underlying process to generate the
  HTML files. React was removed from the project and replaced with remark
  plugins. This improves build times and give us more control over the whole
  process. For example there is no need anymore for running `npx hyperbook
setup`.

  I also added a new pagelist directive, which can be used to list pages based
  on user-defined criteria. This directive also replaces the included glossary
  page. Therefore, you need to create on yourself. This can be easily done by
  creating a page `glossary.md` with the following content:

  ```md
  ---
  name: Glossary
  ---

  ::pagelist{format="glossary" source="href(/glossary/)"}
  ```

  Additionally, I added the ability to use custom JavaScript and CSS-files - see
  the documentation under Advanced Features - in addition to using HTML in your
  hyperbook, when the `allowDangerousHtml` option is enabled in your config.

  I also improved the appearance of custom links, by moving them to the
  footer on mobile devices.

## 0.9.7

### Patch Changes

- [`2bfe682`](https://github.com/openpatch/hyperbook/commit/2bfe6828e578399c405bf4fc52fb1845efe2fb6a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update packages

## 0.9.6

### Patch Changes

- Fix wbr visible on page

## 0.9.5

### Patch Changes

- [`4a3a21f`](https://github.com/openpatch/hyperbook/commit/4a3a21f40c0355c308e8dcb723234c0434aced23) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

- Updated dependencies [[`4a3a21f`](https://github.com/openpatch/hyperbook/commit/4a3a21f40c0355c308e8dcb723234c0434aced23)]:
  - @hyperbook/drawer@0.1.2
  - @hyperbook/provider@0.4.2

## 0.9.4

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.4.1

## 0.9.3

### Patch Changes

- [`d723aaf`](https://github.com/openpatch/hyperbook/commit/d723aafed2eab1ebef7eda5055ba59f2d4e16a9b) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix fs module for windows. This should also fix the vscode extension on windows.

## 0.9.2

### Patch Changes

- [`bfa3016`](https://github.com/openpatch/hyperbook/commit/bfa30169bf2e6377385c6a1adb5aa625db7d1b68) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug with remark

- [`e84275a`](https://github.com/openpatch/hyperbook/commit/e84275a11949e455be4a00742528541b969d52f1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

- [`42ab56f`](https://github.com/openpatch/hyperbook/commit/42ab56f0e07a5adca5e7485a61d21d59d41ad100) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix missing package

## 0.9.1

### Patch Changes

- Updated dependencies [[`75a3227`](https://github.com/openpatch/hyperbook/commit/75a322721e2e0af3c248ab12fb72cca357d6f4d8)]:
  - @hyperbook/drawer@0.1.1

## 0.9.0

### Minor Changes

- [`9bb80bb`](https://github.com/openpatch/hyperbook/commit/9bb80bbd711a2ec11d84f2263c581d42e92fd7de) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Move to pure ESM packages

### Patch Changes

- Updated dependencies [[`9bb80bb`](https://github.com/openpatch/hyperbook/commit/9bb80bbd711a2ec11d84f2263c581d42e92fd7de)]:
  - @hyperbook/provider@0.4.0
  - @hyperbook/drawer@0.1.0

## 0.8.1

### Patch Changes

- [`c6c7d1f`](https://github.com/openpatch/hyperbook/commit/c6c7d1f3dda16879166398916792025545e344ea) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix unified package wrong export error

- [`9851b21`](https://github.com/openpatch/hyperbook/commit/9851b21db8d19c849110eca623bfc450c76e06b9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - bundle unified to handle wrong import

## 0.8.0

### Minor Changes

- [`ff0e867`](https://github.com/openpatch/hyperbook/commit/ff0e86788d967194d442026b49d23082960c66da) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve the build of hyperbooks and the generation of the toc.

## 0.7.0

### Minor Changes

- [`4e264d1`](https://github.com/openpatch/hyperbook/commit/4e264d166684ba476460fd48fedfae2f7e2a3195) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - open external links in a new window or tab

- [`902c0b3`](https://github.com/openpatch/hyperbook/commit/902c0b30a0aa97984350cfd58ad88d38ef7b4cd6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve static site generation

### Patch Changes

- Updated dependencies [[`902c0b3`](https://github.com/openpatch/hyperbook/commit/902c0b30a0aa97984350cfd58ad88d38ef7b4cd6)]:
  - @hyperbook/provider@0.3.0

## 0.6.4

### Patch Changes

- [`edf8e94`](https://github.com/openpatch/hyperbook/commit/edf8e943e9b9c393121cfc1d859dc91e44af30c1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix data not defined

- Updated dependencies [[`edf8e94`](https://github.com/openpatch/hyperbook/commit/edf8e943e9b9c393121cfc1d859dc91e44af30c1)]:
  - @hyperbook/provider@0.2.5

## 0.6.3

### Patch Changes

- [`832678b`](https://github.com/openpatch/hyperbook/commit/832678b39f6a1a6e5cdd361c9c384d341762c09e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update packages

- Updated dependencies [[`832678b`](https://github.com/openpatch/hyperbook/commit/832678b39f6a1a6e5cdd361c9c384d341762c09e)]:
  - @hyperbook/provider@0.2.4

## 0.6.2

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.2.3

## 0.6.1

### Patch Changes

- [`cf58c13`](https://github.com/openpatch/hyperbook/commit/cf58c13ca19aaba8e20e6e1cb27ab3ebbfb74d37) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

- Updated dependencies [[`cf58c13`](https://github.com/openpatch/hyperbook/commit/cf58c13ca19aaba8e20e6e1cb27ab3ebbfb74d37)]:
  - @hyperbook/provider@0.2.2

## 0.6.0

### Minor Changes

- [`764a681`](https://github.com/openpatch/hyperbook/commit/764a681e4a8b0135ffa83f0a30c4cda23b79babd) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - You can now add customs ids to headings. This allow for stable links even if the content of the heading changes.

### Patch Changes

- [`fa2719e`](https://github.com/openpatch/hyperbook/commit/fa2719ebb2bd535aa09a9358ebb53c5c277ad630) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix use custom id in heading component.

## 0.5.3

### Patch Changes

- [`0c58ad8`](https://github.com/openpatch/hyperbook/commit/0c58ad80c3c8b145868d2c0303d42478ec0a9978) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix type error in the remove comments plugin for rehype.

## 0.5.2

### Patch Changes

- [`ac262ca`](https://github.com/openpatch/hyperbook/commit/ac262ca4a60b313dafbce33e5c0d753fd504f012) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve the css for image lightboxes. The cursor now only changes when hovering the image and not the left and right border.

## 0.5.1

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.2.1

## 0.5.0

### Minor Changes

- [`60e8fb1`](https://github.com/openpatch/hyperbook/commit/60e8fb1a3a95d7797234a0ba4f64adba65b74792) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve code copying behaviour on iOS and improve styling for inline code snippets on every platform.

## 0.4.3

### Patch Changes

- [`5758cf0`](https://github.com/openpatch/hyperbook/commit/5758cf025f81b3ec6e5c33d6309ca47166e6db3a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix: Move optional break to text instead of title

## 0.4.2

### Patch Changes

- [`23413c7`](https://github.com/openpatch/hyperbook/commit/23413c74ae0338c063d13f98a78b08ffb8d7f065) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix format title not url of a link.

## 0.4.1

### Patch Changes

- [#458](https://github.com/openpatch/hyperbook/pull/458) [`27032d1`](https://github.com/openpatch/hyperbook/commit/27032d1d76a07b590c18094139ba4a4bf74780c3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Optimize line breaks. We now insert an optional word break point into links. So the browser knows when to break it. For this we follow this guide: https://css-tricks.com/better-line-breaks-for-long-urls/. This does also fix issue #451

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
