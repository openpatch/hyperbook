# openscad

`:::openscad` renders OpenSCAD (3D CAD) models. One `scad`-fenced block per file:
the main model without a name (it becomes `main.scad`), further files with
`file="parts.scad"` on the fence; or a `.scad` file via `src`.

    :::openscad

    ```scad
    cube(10);
    ```

    :::

`dock` (flag, or `dock="Label"`): readers can move the element into the dock
beside the text, to keep it in view while working through the tasks after it.
See the `dock` topic.
