---
name: OpenSCAD
permaid: openscad
---

# OpenSCAD

The OpenSCAD WebAssembly runtime, optional libraries (BOSL2, BOSL, MCAD, NopSCADlib, fonts), and Roboto font are included locally in the exported book. The CLI downloads and caches them the first time a build uses this element. The editor, libraries, and font work without a CDN connection.

The `openscad` directive provides an interactive OpenSCAD editor with:

- a **code view**,
- a **parameter view** (JSON object mapped to `-D` variables),
- and a **3D preview**.

You can render the model, copy the code, and download exports as **STL** or **3MF**.

## Usage

Wrap OpenSCAD code in a `:::openscad` block and use a `scad` (or `openscad`) code fence.

````md
:::openscad

```scad
cube([20,20,20], center=true);
```

:::
````

:::openscad

```scad
cube([20,20,20], center=true);
```

:::

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `id` | Unique id for persistence | auto-generated |
| `main` | The file that is rendered | `main.scad` |
| `height` | Height of the editor/preview container | `calc(100dvh - 80px)` |
| `library` | Comma-separated list of libraries to load into the OpenSCAD environment | none |
| `files` | What readers may do with files: `create`, `upload`, `rename`, `delete`, comma-separated, or `open` for all | `upload` |
| `accept` | Extensions of files readers create or rename, comma-separated | `.scad` |

Possible libraries include: BOSL2, BOSL, MCAD, NopSCADlib, fonts

## Load code from file

````md
:::openscad
::file{path="main.scad" src="openscad/example.scad"}
:::
````

## Several files

Further files get a name with `file="…"` and show up as tabs. The main file can `include` or `use` them:

````md
:::openscad

```scad
include <parts.scad>
part(10);
```

```scad file="parts.scad"
module part(s) { cube([s, s, s]); }
```

:::
````

## Load binary files into the OpenSCAD filesystem

Use `::file` lines inside the `:::openscad` block to add meshes, images or fonts from your book. They are placed next to the main file, at their `path`:

````md
:::openscad

::file{path="input/model.stl" src="models/model.stl"}

```scad
import("input/model.stl");
```

:::
````

Readers can upload files of their own with the **⤒** tab; they are saved in the browser with the rest of the model.

Relative paths in `import()` are also supported and resolved like Typst assets (relative to the current page). Example:

````md
:::openscad

```scad
import("./koala.svg", center=true);
```

:::
````

## Example with variables

````md
:::openscad

```scad
segments = 5;
size = 5;
height = 10;
rounded = 1;
label = "K";

$fn = segments;

module body(size, height, rounded) {
  if (rounded) {
    minkowski() {
      cube([size, size, height], center=true);
      sphere(r=1);
    }
  } else {
    cube([size, size, height], center=true);
  }
}

difference() {
  body(size, height, rounded);
  translate([0, 0, height / 2 + 0.1])
    linear_extrude(height=1)
      text(label, size=8, halign="center", valign="center");
}
```

:::
````

:::openscad

```scad
segments = 5;
size = 5;
height = 10;
rounded = 1;
label = "K";

$fn = segments;

module body(size, height, rounded) {
  if (rounded) {
    minkowski() {
      cube([size, size, height], center=true);
      sphere(r=1);
    }
  } else {
    cube([size, size, height], center=true);
  }
}

difference() {
  body(size, height, rounded);
  translate([0, 0, height / 2 + 0.1])
    linear_extrude(height=1)
      text(label, size=8, halign="center", valign="center");
}
```

:::

## Example with Library

````hyperbook
:::openscad{library="BOSL2"}
```scad
include <BOSL2/std.scad>
include <BOSL2/walls.scad>

$fn = 100;
rod_diameter = 12;

module bridge(width = 230, height = 80, rod_diameter = 12) {
  pilar_width = height / 2;
  pilar_height = height + 5;
  middle_width = width - pilar_width * 2;
  middle_thickness = max(rod_diameter, 19);
  rod_diameter_plus_threshold = rod_diameter + 0.5;
  module pilar() {
    difference() {
      cube([pilar_width, middle_thickness + 10, pilar_height], center=true);
      rotate([90, 0, 0])
      translate([0, 0, -middle_thickness/2])
      cylinder(h=middle_thickness, d=rod_diameter_plus_threshold, center=true);
      rotate([90, 0, 0])
      translate([0, 0, middle_thickness/2])
      cylinder(h=middle_thickness, d=rod_diameter_plus_threshold / 4, center=true);
      translate([0, 0, pilar_height/2])
      cylinder(h=rod_diameter_plus_threshold*2, d=rod_diameter_plus_threshold, center=true);
      translate([0, 0, -pilar_height/2])
      cylinder(h=rod_diameter_plus_threshold*2, d=rod_diameter_plus_threshold, center=true);
    }
  }

  module middle() {
    s = [[0, 0], [middle_width, 0], [middle_width, -height / 2 - 20], [middle_width - 20, -height / 2 - 10], [20, -height / 2 - 10], [0, -height / 2 - 20]];
    rotate([90, 0, 0])
    translate([0,2.5,0])
      hex_panel(s, 2, 10, h=12, frame=5);
  }

  middle();
  translate([-pilar_width / 2, 0, -height/2])
    pilar();
  translate([middle_width + pilar_width / 2, 0, -height/2])
    pilar();
}

bridge(rod_diameter=rod_diameter);
```

:::
````

:::openscad{library="BOSL2"}
```scad
include <BOSL2/std.scad>
include <BOSL2/walls.scad>

$fn = 100;
rod_diameter = 12;

module bridge(width = 230, height = 80, rod_diameter = 12) {
  pilar_width = height / 2;
  pilar_height = height + 5;
  middle_width = width - pilar_width * 2;
  middle_thickness = max(rod_diameter, 19);
  rod_diameter_plus_threshold = rod_diameter + 0.5;
  module pilar() {
    difference() {
      cube([pilar_width, middle_thickness + 10, pilar_height], center=true);
      rotate([90, 0, 0])
      translate([0, 0, -middle_thickness/2])
      cylinder(h=middle_thickness, d=rod_diameter_plus_threshold, center=true);
      rotate([90, 0, 0])
      translate([0, 0, middle_thickness/2])
      cylinder(h=middle_thickness, d=rod_diameter_plus_threshold / 4, center=true);
      translate([0, 0, pilar_height/2])
      cylinder(h=rod_diameter_plus_threshold*2, d=rod_diameter_plus_threshold, center=true);
      translate([0, 0, -pilar_height/2])
      cylinder(h=rod_diameter_plus_threshold*2, d=rod_diameter_plus_threshold, center=true);
    }
  }

  module middle() {
    s = [[0, 0], [middle_width, 0], [middle_width, -height / 2 - 20], [middle_width - 20, -height / 2 - 10], [20, -height / 2 - 10], [0, -height / 2 - 20]];
    rotate([90, 0, 0])
    translate([0,2.5,0])
      hex_panel(s, 2, 10, h=12, frame=5);
  }

  middle();
  translate([-pilar_width / 2, 0, -height/2])
    pilar();
  translate([middle_width + pilar_width / 2, 0, -height/2])
    pilar();
}

bridge(rod_diameter=rod_diameter);
```

:::

## Files readers may change

With `files`, readers get buttons for their own files: **+** creates a file, **⤒** uploads one, and each tab gets **✎** to rename and **×** to delete it. `rename` and `delete` allow it for the files of the page too; the main file and `readonly`, `hidden` and test files always stay as written. Files readers created or uploaded they can always rename and delete. Clicking the tab of a binary file shows a preview: images, audio and video, PDFs, fonts (TTF, OTF, WOFF) and 3D models (STL, OBJ), which you can turn and zoom.

````md
:::openscad{files="create,upload,rename,delete"}
...
:::
````

## Upgrading from the old syntax

Older books loaded files with `src="…"` on the directive and `@file dest="…" src="…"` lines. Run `npx hyperbook migrate` in your book to convert these pages; it also keeps the models readers saved.
