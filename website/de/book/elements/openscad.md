---
name: OpenSCAD
permaid: openscad
lang: de
---

# OpenSCAD

:::alert{warn}
**Erfordert eine Netzwerkverbindung für optionale Bibliotheken und Schriftarten.** Wenn du eine Bibliothek (BOSL2, BOSL, MCAD, NopSCADlib, Fonts) im Editor auswählst, wird die entsprechende ZIP-Datei (~56 KB–4,3 MB) von `ochafik.com` heruntergeladen. Die Roboto-Schriftart der Editor-Oberfläche wird von Google Fonts geladen. Diese Ressourcen sind nicht im Hyperbook-Build-Output enthalten. Der OpenSCAD-Editor selbst funktioniert offline, aber Bibliotheken und die benutzerdefinierte Schriftart sind dann nicht verfügbar.
:::

Die `openscad`-Direktive bietet einen interaktiven OpenSCAD-Editor mit:

- einer **Code-Ansicht**,
- einer **Parameter-Ansicht** (JSON-Objekt, das auf `-D`-Variablen gemappt wird),
- und einer **3D-Vorschau**.

Sie können das Modell rendern, den Code kopieren und als **STL** oder **3MF** herunterladen.

## Verwendung

Packen Sie OpenSCAD-Code in einen `:::openscad`-Block und verwenden Sie einen `scad`- (oder `openscad`-) Codeblock.

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

## Attribute

| Attribut | Beschreibung | Standard |
|---|---|---|
| `id` | Eindeutige ID für Persistenz | automatisch generiert |
| `src` | Lädt Quellcode aus einem externen Dateipfad | eingebetteter Codeblock |
| `height` | Höhe des Editor-/Vorschau-Containers | `calc(100dvh - 80px)` |
| `library` | Kommaseparierte Liste von Bibliotheken, die in die OpenSCAD-Umgebung geladen werden sollen | keine |

Mögliche Bibliotheken sind: BOSL2, BOSL, MCAD, NopSCADlib, fonts

## Code aus Datei laden

````md
:::openscad{src="openscad/example.scad"}
:::
````

## Beispiel mit Variablen

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

## Beispiel mit Bibliothek

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
