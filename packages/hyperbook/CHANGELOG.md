# hyperbook

## 0.5.7

### Patch Changes

- Updated dependencies [[`5ca2ccf`](https://github.com/openpatch/hyperbook/commit/5ca2ccfec72a841ec9c4e43a03ceb2be68710541)]:
  - @hyperbook/types@0.2.0

## 0.5.6

### Patch Changes

- Updated dependencies [[`9472583`](https://github.com/openpatch/hyperbook/commit/947258359e33a39362c070f6c7128f214a79c4c5)]:
  - @hyperbook/types@0.1.0

## 0.5.5

### Patch Changes

- [#316](https://github.com/openpatch/hyperbook/pull/316) [`cedb551`](https://github.com/openpatch/hyperbook/commit/cedb55191fd025b5a214df406a53cbab5d1b1bc1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Extract Hyperbook types into a separate package

- Updated dependencies [[`cedb551`](https://github.com/openpatch/hyperbook/commit/cedb55191fd025b5a214df406a53cbab5d1b1bc1)]:
  - @hyperbook/types@0.0.1

## 0.5.4

### Patch Changes

- [`23f451f`](https://github.com/openpatch/hyperbook/commit/23f451f9bd8ed8ea54f4403fabb4e8d09fe1a9a9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - replace workspace version with the latest on npm

## 0.5.3

### Patch Changes

- [`9ea5483`](https://github.com/openpatch/hyperbook/commit/9ea5483512fd5134f6823104a68fecea2c50cb00) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Force package update due to failed pipeline

## 0.5.2

### Patch Changes

- [`84bba40`](https://github.com/openpatch/hyperbook/commit/84bba40a449b01bffe5ec86a7fe484cbd4a064e0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug requiring admin permissions for creating symlinks #294

## 0.5.1

### Patch Changes

- [`0ce671d`](https://github.com/openpatch/hyperbook/commit/0ce671d61ac57e6526ddecae7e510c06160c174e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Throw error if archiving fails

* [`d43ec9e`](https://github.com/openpatch/hyperbook/commit/d43ec9e145b1b1b23d2cea5054f9ee0ddd3bc535) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Do not fail if not archives folder is present

## 0.5.0

### Minor Changes

- [`3334df5`](https://github.com/openpatch/hyperbook/commit/3334df5297945b431df01e1f5392db84d7e7d1ff) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add auto archives to supply for example code templates or other files which you
  want to distribute in bulk in a folder. (Single files can still be put into the
  public folder)

  You can put folders inside a `archives` folder in the root of your hyperbook.
  These folders will be zipped and put into the `public` folder. You can easily
  provide the zipped folders by using the `archive` directive.

  ```
  :archive[Download me!]{name="project-1"}
  ```

## 0.4.3

### Patch Changes

- [`0325b9d`](https://github.com/openpatch/hyperbook/commit/0325b9ddce534f7133ff355ca0dbf1f8ddb08437) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Always create next.config.js

## 0.4.2

### Patch Changes

- [`e51a573`](https://github.com/openpatch/hyperbook/commit/e51a573f4bedf540ec9adc53e1111bcf0edc5e4b) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add proper error handling and check for updates before each command

## 0.4.1

### Patch Changes

- [`1907ed4`](https://github.com/openpatch/hyperbook/commit/1907ed431f636c966e17a20bee2e2bd5725ff17b) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Use parseAsync insted of parse to fix incorrect exit code

## 0.4.0

### Minor Changes

- [`3ffbfeb`](https://github.com/openpatch/hyperbook/commit/3ffbfebd78012ad8bf0ca2093a322cacfe80a266) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - add creative commons license chooser

## 0.3.0

### Minor Changes

- [`3c2ad77`](https://github.com/openpatch/hyperbook/commit/3c2ad77c106040c9a58b56d87101e438961d49a3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add bookmarks to default template

## 0.2.1

### Patch Changes

- [`005d429`](https://github.com/openpatch/hyperbook/commit/005d429a761ee33a29e6804fb2957f3a96038dcc) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Ignore typescript errors when building hyperbook. This should be handled by template authors.

## 0.2.0

### Minor Changes

- [`1c8ce7e`](https://github.com/openpatch/hyperbook/commit/1c8ce7e4da5d0707517a8b3e131093d1614df5a7) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add basePath option for deploying to subdirectories.

## 0.1.3

### Patch Changes

- [`1bf960b`](https://github.com/openpatch/hyperbook/commit/1bf960bf5843777ee5e47ba0848d45a7ea94e200) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add missing template folder to dist directory

## 0.1.2

### Patch Changes

- [`c5a3fdb`](https://github.com/openpatch/hyperbook/commit/c5a3fdbff48374b303f3fdd1f65949b955c37613) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add missing files

## 0.1.1

### Patch Changes

- [`b77fc21`](https://github.com/openpatch/hyperbook/commit/b77fc21bf6e098a379c8573dee70aaf1988c0305) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Create symlink for glossary

## 0.1.0

### Minor Changes

- [`ce2282b`](https://github.com/openpatch/hyperbook/commit/ce2282b872493fc525ff7eabde6e7a0d08a4ff67) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Initial release of hyperbook
