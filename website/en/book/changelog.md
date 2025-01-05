---
name: Changelog
---

# Changelog

The entire release archive of hyperbook is available on [NPM](https://www.npmjs.com/package/hyperbook)

:::alert{info}

If you need a new feature, open an [issue](https://github.com/openpatch/hyperbook/issues) and let's discuss.

:::

<!--
## v0.41.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Allow emojis in tab titles. E.g.: `:::tab{title="Hi :smile:"}`

:::

:::tab{title="Improved :+1:" id="improved"}



:::

:::tab{title="Fixed :bug:" id="fixed"}



:::

::::
-->
## v0.47.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Save every state of the hyperbook and make it available for download. To enable this feature, set `importExport` to `true` in the configuration file. The buttons for importing and exporting will be at the bottom of the page. The state of the hyperbook will be saved as a JSON file. The file can be imported again to restore the state of the hyperbook. 
- The code of the editor for the elements P5, Pyide, ABC-Music can now be copied, download or resetted.
- Add i18n support. Currently, only `en` and `de` are supported. You need to set the `language` in the configuration file. [Learn more](/configuration/book) 
    - If you want to contribute a new language, please create a pull-request and add a new locale in `packages/markdown/locales`.

:::

::::

## v0.46.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Resolved an issue where interactive elements failed to initialize correctly after being revealed within the protect element.
- Fixed an issue where collapsibles with the same ID were not synchronized.

:::

::::

## v0.46.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Resolved an issue where interactive elements failed to initialize correctly after being revealed within the protect element.
- Fixed an issue where collapsibles with the same ID were not synchronized.

:::

::::

## v0.46.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Add `trailingSlash` option. When this option is enabled only directories and `index.html` files will be produced, when building the hyperbook. [Learn more](/configuration/book)

:::

::::

## v0.45.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- You can now add inputs and tests to your pyide element. [Learn more](/elements/pyide)

:::

::::

## v0.44.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- A new element pyide that allows you to run python in your browser. [Learn more](/elements/pyide)

:::

::::

## v0.43.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- A new element p5 that allows you to create p5.js sketches was added. [Learn more](/elements/p5)

:::

::::


## v0.42.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Add abc-music element for creating and listing to note written in the abcnotation. [Learn more](/elements/abc-music)

:::

::::

## v0.41.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Allow emojis in tab titles. E.g.: `:::tab{title="Hi :smile:"}`

:::

::::