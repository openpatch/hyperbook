# @hyperbook/types

## 0.15.1

### Patch Changes

- [`c18ba75`](https://github.com/openpatch/hyperbook/commit/c18ba75d415e3d23eb1fafb7ebe69eac082457e0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix colons in headings not working. Fix spaces in filenames causing trouble. Add option to disable code highlighting and copy button for inline code blocks.

## 0.15.0

### Minor Changes

- [`b914f85`](https://github.com/openpatch/hyperbook/commit/b914f8580aaae9969cb2be97b5ab6f1e7ce8564f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - You can now collocate images, videos, and other additional files directly within your book directory. This means you can reference media using relative paths, making it much easier to:

  - Organize your content intuitively
  - Collaborate with others
  - Share or version-control your Hyperbook with media included

  Example usage:

  ```md
  ![Image in the same directory as this markdown file](./image.png)
  ![Image one directory up relative to this markdown file](../image.png)
  ```

  This improvement enables a more seamless and portable authoring experience—no more managing separate static folders or absolute paths.

## 0.14.0

### Minor Changes

- [`b5a41e0`](https://github.com/openpatch/hyperbook/commit/b5a41e00a014a77dd13a5e8d13009c5c2462cb15) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - - Save every state of the hyperbook and make it available for download. To enable this feature, set `importExport` to `true` in the configuration file. The buttons for importing and exporting will be at the bottom of the page. The state of the hyperbook will be saved as a JSON file. The file can be imported again to restore the state of the hyperbook.
  - The code of the editor for the elements P5, Pyide, ABC-Music can now be copied, download or resetted.

## 0.13.0

### Minor Changes

- [`cd6535e`](https://github.com/openpatch/hyperbook/commit/cd6535e236f8ae64b28003dd196f37413a50e5a3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add trailingSlash back

## 0.12.0

### Minor Changes

- [#907](https://github.com/openpatch/hyperbook/pull/907) [`eaeaf29`](https://github.com/openpatch/hyperbook/commit/eaeaf293532494607385f4e8d927ffb3716dcc6f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add option to enable search. Just set the search key to true in your hyperbook config and a search icon will be visible in the top right hand corner.

## 0.11.0

### Minor Changes

- [`d9f0b71`](https://github.com/openpatch/hyperbook/commit/d9f0b711775195fc56d9706dc196edf577591b2e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Allow permaids to be set in the frontmatter of a page. The permaids can be use in links and in the frontmatter for next and prev. See the page configuration documentation for details. All pages with permaids are available at /@/[permaid].

## 0.10.0

### Minor Changes

- [#894](https://github.com/openpatch/hyperbook/pull/894) [`8536870`](https://github.com/openpatch/hyperbook/commit/8536870623eb21bfaeffc0c65022584c26ea75c9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - add option to show a qr code to the current page

## 0.9.0

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

## 0.8.1

### Patch Changes

- [`4a3a21f`](https://github.com/openpatch/hyperbook/commit/4a3a21f40c0355c308e8dcb723234c0434aced23) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

## 0.8.0

### Minor Changes

- [`90c99bd`](https://github.com/openpatch/hyperbook/commit/90c99bd0edc9ea8da5e1c6376e09d1977f881870) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add prev and next properties to pages. This will allow you to set the prev and next buttons to an individual page by using the absolute path to the page.

## 0.7.0

### Minor Changes

- [`9bb80bb`](https://github.com/openpatch/hyperbook/commit/9bb80bbd711a2ec11d84f2263c581d42e92fd7de) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Move to pure ESM packages

## 0.6.1

### Patch Changes

- [`832678b`](https://github.com/openpatch/hyperbook/commit/832678b39f6a1a6e5cdd361c9c384d341762c09e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update packages

## 0.6.0

### Minor Changes

- [`4221fe1`](https://github.com/openpatch/hyperbook/commit/4221fe145a6dfffd9f97459fa2d2694da4b5d78e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - add global configuration options for onlineide and sqlide

## 0.5.0

### Minor Changes

- [`104f2de`](https://github.com/openpatch/hyperbook/commit/104f2de6fa054ecadaf19811c5f8c3c560ca5a64) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Repo can now be configured. So you can customize the label of the edit button on a page and you can insert the current path anywhere in the link, by using "%path%" placeholder.

## 0.4.0

### Minor Changes

- [#392](https://github.com/openpatch/hyperbook/pull/392) [`8d53899`](https://github.com/openpatch/hyperbook/commit/8d538999fc924f7b3e3115416cba4978c9589b68) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Extract core funcationality from platfrom web into separate packages. This helps us to support more platforms.

## 0.3.0

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

## 0.2.0

### Minor Changes

- [#363](https://github.com/openpatch/hyperbook/pull/363) [`5ca2ccf`](https://github.com/openpatch/hyperbook/commit/5ca2ccfec72a841ec9c4e43a03ceb2be68710541) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add custom links support. Custom links can now be configured in your `hyperbook.json`. See the book configuration documentation for more information on how to set them up.

## 0.1.0

### Minor Changes

- [#326](https://github.com/openpatch/hyperbook/pull/326) [`9472583`](https://github.com/openpatch/hyperbook/commit/947258359e33a39362c070f6c7128f214a79c4c5) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add configuration options to the hyperbook.json for the element bookmarks and excalidraw.

## 0.0.1

### Patch Changes

- [#316](https://github.com/openpatch/hyperbook/pull/316) [`cedb551`](https://github.com/openpatch/hyperbook/commit/cedb55191fd025b5a214df406a53cbab5d1b1bc1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Extract Hyperbook types into a separate package
