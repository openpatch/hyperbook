---
name: Excalidraw
---

# Excalidraw

Excalidraw is an excellent tool that offers a whiteboard on which you can easily
sketch diagrams with a hand-drawn feel. You can use
[https://excalidraw.com/](https://excalidraw.com/), download your drawing as a
JSON-file, put it in the public directory and create an Excalidraw element (see
below).

You could also use the integrated editor in hyperbook. When running your
hyperbook in development mode, you see two buttons below an Excalidraw
whiteboard and all editor options. You can edit your whiteboard here and just
hit save. The Excalidraw will be saved at the place which you have defined.

The Excalidraw element accepts these arguments:

- **src**: A path to an Excalidraw file, if it does not exists it will be created, when using the editor in development mode.
- **aspectRatio**: To keep your Excalidraw nice on every device you need to provide an aspect-ratio, e.g.: "16/9", "4/3", "1/1".
- **autoZoom**: By default your Excalidraw will auto zoom to look the same even when viewed on a smaller device. You can disable it by passing false to autoZoom.
- **edit**: Allows to edit the Excalidraw.

:::alert{info}
autoZoom does not seems to work, when using a file from excalidraw.com, since the file does not come with its original dimensions.
:::

```md
::excalidraw{src="/excalidraw/hyperbook.excalidraw" aspectRatio="4/3"}

::excalidraw{src="/excalidraw/hyperbook.excalidraw" aspectRatio="4/3" autoZoom=false}

::excalidraw{src="/excalidraw/hyperbook.excalidraw" aspectRatio="4/3" autoZoom=true edit=true}
```

::excalidraw{src="/excalidraw/hyperbook.excalidraw" aspectRatio="4/3"}

::excalidraw{src="/excalidraw/hyperbook.excalidraw" aspectRatio="4/3" autoZoom=false}

:::alert{info}
Be sure to set the correct language in your hyperbook config src, otherwise Excalidraw will use the English. For example for German use "de".
:::

::excalidraw{src="/excalidraw/hyperbook.excalidraw" aspectRatio="4/3" autoZoom=true edit=true}

## Adding Libraries

If you want to add libraries, you can download one from https://libraries.excalidraw.com and import it by clicking the book icon in the top right corner and then the folder icon to select the library.

## Configuration

You can configure the default value of the arguments in the `hyperbook.json`. For example:

```json
{
  "elements": {
    "excalidraw": {
      "aspectRatio": "4/3",
      "autoZoom": true,
      "edit": false
    }
  }
}
```
