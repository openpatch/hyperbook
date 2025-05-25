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

## v0.52.5

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}
    - CLI argument port was not used. Now it is working again. For example: `hyperbook dev --port 3000`
:::

:::

::::

## v0.52.4

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}
    - Dev server was not respecting the `basePath` configuration option. Now it is working again.
:::

:::

::::

## v0.52.3

::::tabs

:::tab{title="Improved :+1:" id="improved"}
  - Default to youtube-nocookie for youtube videos.
:::

:::

::::

## v0.52.2

::::tabs

:::tab{title="Improved :+1:" id="improved"}
  - Improve table responsive design.
:::

:::

::::

## v0.52.1

::::tabs

:::tab{title="Improved :+1:" id="improved"}
- Update dependencies
    - P5 to version 2.0.0
    - Excalidraw to version 0.18.0
    - Mermaid to version 11.6.0
:::

:::

::::

## v0.52.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}
- A new element multievent that allows you to handle multiple events in a single interactive component. This feature is particularly useful for creating quizzes and other complex interactive scenarios where a single user's answers are evaluated directly with immediate feedback on whether they are correct or not. [Learn more](/elements/multievent)
:::

:::

::::

## v0.51.1

::::tabs

:::tab{title="Improved :+1:" id="improved"}

Styling Improvements:
- Increased the width of the navigation to utilize more horizontal space.
- Reduced base font size to 14px for improved readability and a more compact layout.
- Decreased header height to 60px to maximize vertical content space.

:::

::::

## v0.51.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- In addition to GeoGebra you can now use JSXGraph for creating math visualizations. [Learn more](/elements/jsxgraph)

:::

::::

## v0.50.5

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- The development server does not crash anymore, when an error occurs.

:::

::::

## v0.50.4

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- The GeoGebra reset button now resets the GeoGebra element to its initial state.

:::

::::

## v0.50.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix GeoGebra element not resize correctly in collapsibles, again.

:::

::::

## v0.50.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix GeoGebra element not resize correctly in collapsibles.

:::

::::

## v0.50.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Improve responsive scaling of the GeoGebra element.
- Save and load the state of the GeoGebra element.

:::

::::

## v0.50.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- The h5p element allows you to embed H5P content directly into your hyperbook. H5P is an open-source platform for creating, sharing, and reusing interactive content. With the h5p element, you can easily integrate H5P content such as quizzes, interactive videos, and presentations into your hyperbook. [Learn more](/elements/h5p)

:::

::::

## v0.49.4

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Update mermaid to 11.4.1
- Update p5 to 1.11.3
- Update wavesurfer.js to 7.9.0

:::

::::

## v0.49.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix missing right border in the struktog element

:::

::::


## v0.49.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Add footnote translation for german.

:::

::::

## v0.49.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix collapsibles not having a default id and therefore not working correctly.

:::

::::

## v0.49.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Make hyperbook config accessible in snippets.

```md
{{ hyperbook.name }}
```

:::

::::

## v0.48.8

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix p5 element not accepting editor=false.

:::

::::

## v0.48.7

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix sections collapsing before navigating to the new URL.
- Fix active sections not using the brand color.

:::

::::

## v0.48.6

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Remove p5.sound. The library caused the p5-element to stay in the loading stage in Safari for iOS and MacOS.
- Fix the parsing of snippet parameters. Snippet parameters can now include parentheses and other symbols.

:::

::::

## v0.48.5

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix link to section not including the basePath.

:::

::::

## v0.48.4

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix build breaking, when a heading is in a collapsible.

:::

::::

## v0.48.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Remove unwanted `console.log`.

:::

::::

## v0.48.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix search not working.

:::

::::

## v0.48.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix collapsible button styles bleeding into other button styles.

:::

::::

## v0.48.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- The webide element allows you to embed a web-based integrated development environment (IDE) directly into your hyperbook. This feature is particularly useful for interactive coding tutorials and exercises, enabling users to write and run code within the book itself. [Learn more](/elements/webide)

:::

::::

## v0.47.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix tabs and collapsibles not rendering hyperbook elements.

:::

::::

## v0.47.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Development server injected the reload script at the wrong place, if there was an additional body tag. Thus, leading to unwanted behavior e.g. for the p5-element.
- Pyide: The event listener for the run button was not removed, which lead to refreshing the page when the run button was clicked multiple times.

:::

::::

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
