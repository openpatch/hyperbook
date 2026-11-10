# openscad

`:::openscad` renders OpenSCAD (3D CAD) models. One `scad`-fenced block per file:
the main model without a name (it becomes `main.scad`), further files with
`file="parts.scad"` on the fence; or a `.scad` file via `src`.

    :::openscad

    ```scad
    cube(10);
    ```

    :::
