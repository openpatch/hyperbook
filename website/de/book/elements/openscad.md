---
name: OpenSCAD
permaid: openscad
lang: de
---

# OpenSCAD

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

## Code aus Datei laden

````md
:::openscad{src="openscad/example.scad"}
:::
````

## Parameter (JSON)

Öffnen Sie den Tab **Parameters** und geben Sie ein JSON-Objekt an. Jedes Schlüssel/Wert-Paar wird als `-Dname=value` an OpenSCAD übergeben.

Beispiel:

```json
{
  "size": 24,
  "height": 16,
  "segments": 64,
  "rounded": true,
  "label": "A"
}
```

## Beispiel mit Variablen

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
