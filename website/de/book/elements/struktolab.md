---
title: Struktolab
permaid: struktolab
---

# Struktolab

Struktolab ermöglicht es Ihnen, Struktogramme in Ihrem Hyperbook anzuzeigen. Sie können es im Ansichtsmodus verwenden, um Struktogramme anzuzeigen, oder im Bearbeitungsmodus, um Struktogramme direkt in Ihrem Hyperbook zu erstellen und zu bearbeiten.

Für weitere Informationen zur Verwendung von Struktolab siehe die [Struktolab-Dokumentation](https://struktolab.openpatch.org/documentation.html).

## Attribute

- `mode`: "view" | "edit"
- `scale`: number
- `fontSize`: number
- `lang`: "de" | "en" uses the hyperbook language by default
- `colorMode`: "color" | "greyscale" | "bw"

## View

:::struktolab{fontSize=16}

```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")

```

:::

````md
:::struktolab{fontSize=16}
```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")

```
:::
````

## Edit

:::struktolab{fontSize=16 mode="edit" scale=2}

```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")

```

:::

````md
:::struktolab{fontSize=16 mode="edit" scale=2}
```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")

```
:::
````

## Color Modes

### Color

:::struktolab{colorMode="color"}

```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")
```

:::

````md
:::struktolab{colorMode="color"}
```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")
```
:::
````

### Greyscale

:::struktolab{colorMode="greyscale"}

```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")
```

:::

````md
:::struktolab{colorMode="greyscale"}
```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")
```
:::
````

### Black and White

:::struktolab{colorMode="bw"}

```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")
```

:::

````md
:::struktolab{colorMode="bw"}
```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")
```
:::
````
