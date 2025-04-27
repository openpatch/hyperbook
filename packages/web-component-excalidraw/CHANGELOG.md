# @hyperbook/element-excalidraw

## 0.3.2

### Patch Changes

- [`b4b9593`](https://github.com/openpatch/hyperbook/commit/b4b9593aa46c33b47aa311e6aa7c8d0117bd753b) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

## 0.3.1

### Patch Changes

- [`e1720b5`](https://github.com/openpatch/hyperbook/commit/e1720b5eec08da070bd76881e47c23b6850bb880) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update dependencies

## 0.3.0

### Minor Changes

- [`b5a41e0`](https://github.com/openpatch/hyperbook/commit/b5a41e00a014a77dd13a5e8d13009c5c2462cb15) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - - Save every state of the hyperbook and make it available for download. To enable this feature, set `importExport` to `true` in the configuration file. The buttons for importing and exporting will be at the bottom of the page. The state of the hyperbook will be saved as a JSON file. The file can be imported again to restore the state of the hyperbook.
  - The code of the editor for the elements P5, Pyide, ABC-Music can now be copied, download or resetted.

## 0.2.1

### Patch Changes

- [#897](https://github.com/openpatch/hyperbook/pull/897) [`33724b8`](https://github.com/openpatch/hyperbook/commit/33724b8c46c588d30bce661c32244fc34896209f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add p5 element

## 0.2.0

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

## 0.6.2

### Patch Changes

- [`4a3a21f`](https://github.com/openpatch/hyperbook/commit/4a3a21f40c0355c308e8dcb723234c0434aced23) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

- Updated dependencies [[`4a3a21f`](https://github.com/openpatch/hyperbook/commit/4a3a21f40c0355c308e8dcb723234c0434aced23)]:
  - @hyperbook/provider@0.4.2

## 0.6.1

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.4.1

## 0.6.0

### Minor Changes

- [`2b94605`](https://github.com/openpatch/hyperbook/commit/2b9460574a23fcecc66c0a187a56d236891482fe) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update mermaind and excalidraw packages

## 0.5.2

### Patch Changes

- [`f5ddc0c`](https://github.com/openpatch/hyperbook/commit/f5ddc0c53564ea426d31aff69695e8fc91dfa0e9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix auto zoom for excalidraw elements.

## 0.5.1

### Patch Changes

- [`e84275a`](https://github.com/openpatch/hyperbook/commit/e84275a11949e455be4a00742528541b969d52f1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

## 0.5.0

### Minor Changes

- [`9bb80bb`](https://github.com/openpatch/hyperbook/commit/9bb80bbd711a2ec11d84f2263c581d42e92fd7de) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Move to pure ESM packages

### Patch Changes

- Updated dependencies [[`9bb80bb`](https://github.com/openpatch/hyperbook/commit/9bb80bbd711a2ec11d84f2263c581d42e92fd7de)]:
  - @hyperbook/provider@0.4.0

## 0.4.5

### Patch Changes

- Updated dependencies [[`902c0b3`](https://github.com/openpatch/hyperbook/commit/902c0b30a0aa97984350cfd58ad88d38ef7b4cd6)]:
  - @hyperbook/provider@0.3.0

## 0.4.4

### Patch Changes

- [`edf8e94`](https://github.com/openpatch/hyperbook/commit/edf8e943e9b9c393121cfc1d859dc91e44af30c1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix data not defined

- Updated dependencies [[`edf8e94`](https://github.com/openpatch/hyperbook/commit/edf8e943e9b9c393121cfc1d859dc91e44af30c1)]:
  - @hyperbook/provider@0.2.5

## 0.4.3

### Patch Changes

- [`832678b`](https://github.com/openpatch/hyperbook/commit/832678b39f6a1a6e5cdd361c9c384d341762c09e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update packages

- Updated dependencies [[`832678b`](https://github.com/openpatch/hyperbook/commit/832678b39f6a1a6e5cdd361c9c384d341762c09e)]:
  - @hyperbook/provider@0.2.4

## 0.4.2

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.2.3

## 0.4.1

### Patch Changes

- [`cf58c13`](https://github.com/openpatch/hyperbook/commit/cf58c13ca19aaba8e20e6e1cb27ab3ebbfb74d37) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

- Updated dependencies [[`cf58c13`](https://github.com/openpatch/hyperbook/commit/cf58c13ca19aaba8e20e6e1cb27ab3ebbfb74d37)]:
  - @hyperbook/provider@0.2.2

## 0.4.0

### Minor Changes

- [`e087609`](https://github.com/openpatch/hyperbook/commit/e087609de23c4d2868793fec65deee8beb144a78) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - upgrade excalidraw to version 0.15.0

## 0.3.1

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.2.1

## 0.3.0

### Minor Changes

- [`b1415aa`](https://github.com/openpatch/hyperbook/commit/b1415aaf8905a0fa7d119074e3b6731167023671) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update excalidraw to version 0.13.0

## 0.2.3

### Patch Changes

- Updated dependencies [[`8d53899`](https://github.com/openpatch/hyperbook/commit/8d538999fc924f7b3e3115416cba4978c9589b68)]:
  - @hyperbook/provider@0.2.0

## 0.2.2

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.1.7

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.1.6

## 0.2.0

### Minor Changes

- [#326](https://github.com/openpatch/hyperbook/pull/326) [`9472583`](https://github.com/openpatch/hyperbook/commit/947258359e33a39362c070f6c7128f214a79c4c5) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add configuration options to the hyperbook.json for the element bookmarks and excalidraw.

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [[`cedb551`](https://github.com/openpatch/hyperbook/commit/cedb55191fd025b5a214df406a53cbab5d1b1bc1)]:
  - @hyperbook/provider@0.1.4

## 0.1.3

### Patch Changes

- [`c3e747a`](https://github.com/openpatch/hyperbook/commit/c3e747ab7b95c3e526b3800b169aa8f505f9b9a2) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Do not rely on process.env.NODE_ENV and use env prodivded by the provider.

- Updated dependencies [[`c3e747a`](https://github.com/openpatch/hyperbook/commit/c3e747ab7b95c3e526b3800b169aa8f505f9b9a2)]:
  - @hyperbook/provider@0.1.3

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
