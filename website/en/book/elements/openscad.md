---
name: OpenSCAD
permaid: openscad
---

# OpenSCAD

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

## Load code from file

````md
:::openscad{src="openscad/example.scad"}
:::
````

## Parameters (JSON)

Open the **Parameters** tab and provide a JSON object. Each key/value pair is passed to OpenSCAD as `-Dname=value`.

Example:

```json
{
  "size": 24,
  "height": 16,
  "segments": 64,
  "rounded": true,
  "label": "A"
}
```

## Example with variables

````md
:::openscad

```scad
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
