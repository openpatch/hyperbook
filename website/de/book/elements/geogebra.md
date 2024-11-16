---
name: GeoGebra
permaid: geogebra
lang: de
---

# GeoGebra

GeoGebra Applets können auf unterschiedle Art und Weise eingebunden werden.

Zum einen können GeoGebra Anweisungen direkt übergeben werden.

```md
:::geogebra{height=400 width=700 coordsystem="-10,10,-2,8"}

a = Slider[-5,5]
f_a(x) = x^2 * a + a * x

:::
```

:::geogebra{height=400 width=700 coordsystem="-10,10,-2,8"}

a = Slider[-5,5]
f_a(x) = x^2 * a + a * x

:::

Zum anderen können auch bereits bestehende Applets geladen werden.

```md
::geogebra{src="https://www.geogebra.org/m/sA5Mb4vd"}
```

::geogebra{src="https://www.geogebra.org/m/sA5Mb4vd"}

## Argumente

Das Geogebra-Element ist ein einfacher Wrapper für die GeoGebra API. Daher können die Argumente aus der [GeoGebra-Dokumentation](https://geogebra.github.io/docs/reference/en/GeoGebra_App_Parameters/) entnommen werden.

Zusätzlich können auch weitere Argumente festgelegt werden, die aus der ursprünglichen [Web-Komponente](https://somethingorotherwhatever.com/geogebra-component/reference.html) stammen.

| **Argumente**             | **Beschreibung**                                                                                              |
|---------------------------|-------------------------------------------------------------------------------------------------------------|
| perspective               | Definiert, welche Ansichten sichtbar sind und in welcher Reihenfolge. Ein String aus Buchstaben, der Ansichten entsprechend der Dokumentation für SetPerspective beschreibt. |
| axes                      | Eine durch Kommas getrennte Liste von true- oder false-Werten, die definiert, ob jede Achse sichtbar ist, in der Reihenfolge x,y,z.   |
| xaxis                     | Ist die x-Achse sichtbar?                                                                                     |
| yaxis                     | Ist die y-Achse sichtbar?                                                                                     |
| zaxis                     | Ist die z-Achse sichtbar?                                                                                     |
| pointcapture              | Der Punktfangmodus: none, snap, fixed oder automatic.                                                        |
| rounding                  | Wie Zahlen gerundet werden. Eine Zahl gefolgt von d für "Dezimalstellen" oder s für "signifikante Stellen".   |
| hidecursorwhendragging    | Soll der Cursor ausgeblendet werden, wenn Objekte gezogen werden?                                             |
| repaintingactive          | Soll das Applet neu gezeichnet werden, wenn sich etwas ändert?                                               |
| errordialogsactive        | Sollen Fehlermeldungsdialoge angezeigt werden?                                                               |
| coordsystem               | Eine durch Kommas getrennte Liste von Koordinaten für den Ansichtsbereich des Grafikfensters, in der Reihenfolge xmin,xmax,ymin,ymax. |
| axislabels                | Eine durch Kommas getrennte Liste von Beschriftungen für die Achsen, in der Reihenfolge x,y,z.               |
| xaxislabel                | Die Beschriftung für die x-Achse.                                                                            |


Das folgende Beispiel nutzt einige dieser Argumente.

```md
::geogebra{showToolBar showAlgebraInput algebraInputPosition="bottom" enableUndoRedo showMenuBar enableFileFeatures showZoomButtons}
```

::geogebra{showToolBar showAlgebraInput algebraInputPosition="bottom" enableUndoRedo showMenuBar enableFileFeatures showZoomButtons}
