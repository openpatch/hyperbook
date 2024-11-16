---
name: GeoGebra
permaid: geogebra
---

# GeoGebra

GeoGebra applets can be embedded in various ways.

On one hand, GeoGebra instructions can be passed directly.

```md
:::geogebra{perspective="G" height=400 width=700 coordsystem="-10,10,-2,8"}

a = Slider[-5,5]
SetCoords(a, 450, 370)
f_a(x) = x^2 * a + a * x

:::
```

:::geogebra{perspective="G" height=400 width=700 coordsystem="-10,10,-2,8"}

a = Slider[-5,5]
SetCoords(a, 450, 370)
f_a(x) = x^2 * a + a * x

:::

On the other hand, existing applets can also be loaded.

```md
::geogebra{src="https://www.geogebra.org/m/sA5Mb4vd"}
```

::geogebra{src="https://www.geogebra.org/m/sA5Mb4vd"}

## Arguments

The GeoGebra element is a simple wrapper for the GeoGebra API. Therefore, the arguments can be taken from the [GeoGebra Documentation](https://geogebra.github.io/docs/reference/en/GeoGebra_App_Parameters/).

Additionally, you can set other arguments aswell, which come for the original [web-component](https://somethingorotherwhatever.com/geogebra-component/reference.html).

| **Arguments**             | **Description**                                                                                              |
|---------------------------|-------------------------------------------------------------------------------------------------------------|
| perspective               | Define which views are visible, and in which order. A string of letters corresponding to views, as described in the documentation for SetPerspective. |
| axes                      | A comma-separated list of true or false values defining whether each axis is visible, in the order x,y,z.   |
| xaxis                     | Is the x axis visible?                                                                                      |
| yaxis                     | Is the y axis visible?                                                                                      |
| zaxis                     | Is the z axis visible?                                                                                      |
| pointcapture              | The point capturing mode: none, snap, fixed, or automatic.                                                  |
| rounding                  | How to round numbers. A number followed by either d for "decimal places", or s for "significant figures".   |
| hidecursorwhendragging    | Hide the cursor when dragging objects?                                                                      |
| repaintingactive          | Repaint the applet when anything changes?                                                                   |
| errordialogsactive        | Should error dialogs be shown?                                                                              |
| coordsystem               | A comma-separated list of coordinates for the viewport of the graphics window, in the order xmin,xmax,ymin,ymax. |
| axislabels                | A comma-separated list of labels for the axes, in the order x,y,z.                                         |
| xaxislabel                | The label

The following example uses some of these arguments:

```md
::geogebra{showToolBar showAlgebraInput algebraInputPosition="bottom" enableUndoRedo showMenuBar enableFileFeatures showZoomButtons}
```

::geogebra{showToolBar showAlgebraInput algebraInputPosition="bottom" enableUndoRedo showMenuBar enableFileFeatures showZoomButtons}

