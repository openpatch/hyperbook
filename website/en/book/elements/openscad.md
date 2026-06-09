---
name: OpenSCAD
permaid: openscad
---

# OpenSCAD

:::alert{warn}
**Requires a network connection for optional libraries and fonts.** When you select a library (BOSL2, BOSL, MCAD, NopSCADlib, fonts) in the editor, the corresponding ZIP file (~56 KB–4.3 MB) is downloaded from `ochafik.com`. The Roboto font used by the editor UI is loaded from Google Fonts. These resources are not bundled with the hyperbook build output. The core OpenSCAD editor works offline, but libraries and the custom font will not be available.
:::

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
| `src` | Load source from an external file path | inline code block |
| `height` | Height of the editor/preview container | `calc(100dvh - 80px)` |
| `library` | Comma-separated list of libraries to load into the OpenSCAD environment | none |

Possible libraries include: BOSL2, BOSL, MCAD, NopSCADlib, fonts

## Load code from file

````md
:::openscad{src="openscad/example.scad"}
:::
````

## Load binary files into the OpenSCAD filesystem

Use `@file` directives inside the `:::openscad` block to mount binary files before rendering.

In edit mode, you can also use the **Binary Files** panel to upload files directly (stored locally in browser storage for this block).

````md
:::openscad

@file dest="/input/model.stl" src="models/model.stl"

```scad
import("/input/model.stl");
```

:::
````

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
