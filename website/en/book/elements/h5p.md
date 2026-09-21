---
name: H5P
permaid: h5p
---

# H5P

H5P is a free and open-source content collaboration framework based on JavaScript. H5P is short for HTML5 Package, and aims to make it easy for everyone to create, share and reuse interactive HTML5 content. H5P is a popular tool for creating interactive content, such as quizzes, presentations, and games.

You can embed H5P content in your book using the `h5p` element. You can load H5P content from a file.

## Attributes

| Attribute      | Description                                                 | Default                      |
| -------------- | ----------------------------------------------------------- | ---------------------------- |
| `src`          | Path to the H5P file                                        | -                            |
| `export`       | Show the Reuse button for downloading the original H5P file | `false`                      |
| `download-url` | Alternate path or URL downloaded by the Reuse button        | The original file from `src` |

```md
::h5p{src="/test.h5p"}
```

::h5p{src="/test.h5p"}

The best way to create H5P content is to use the [ZUM Apps](https://apps.zum.de) website. You can create and edit H5P content on the website, and then download the content as an H5P file. For this you can use the Reuse button. You can then put the h5p file into your public folder and use it in a h5p-element.

## Example with Reuse-Button

Add the `export` attribute to let readers download and reuse the original `.h5p`
file.

Use `download-url` when the downloadable package is hosted at a different URL.

```md
::h5p{src="/reuse.h5p" export}
```

::h5p{src="/reuse.h5p" export}
