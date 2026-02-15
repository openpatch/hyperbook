---
title: Struktolab
permaid: struktolab
---

# Struktolab

Struktolab allows you to display structograms in your hyperbook. You can use it in view mode to display structograms or in edit mode to create and edit structograms directly in your hyperbook.

For more information on how to use Struktolab, see the [Struktolab documentation](https://struktolab.openpatch.org/documentation.html).

## Attributes

- `mode`: "view" | "edit"
- `scale`: number
- `fontSize`: number
- `lang`: "de" | "en" uses the hyperbook language by default
- `colorMode`: "color" | "greyscale" | "bw"

## View

:::struktolab{fontSize=16}

```
if x > 0:
    output("positiv")
else:
    output("not positiv")

```

:::

````md
:::struktolab{fontSize=16}
```
if x > 0:
    output("positiv")
else:
    output("not positiv")

```
:::
````

## Edit

:::struktolab{fontSize=16 mode="edit" scale=2}

```
if x > 0:
    output("positiv")
else:
    output("not positiv")

```

:::

````md
:::struktolab{fontSize=16 mode="edit" scale=2}
```
if x > 0:
    output("positiv")
else:
    output("not positiv")

```
:::
````

## Color Modes

### Color

:::struktolab{colorMode="color"}

```
if x > 0:
    output("positiv")
else:
    output("not positiv")
```

:::

````md
:::struktolab{colorMode="color"}
```
if x > 0:
    output("positiv")
else:
    output("not positiv")
```
:::
````

### Greyscale

:::struktolab{colorMode="greyscale"}

```
if x > 0:
    output("positiv")
else:
    output("not positiv")
```

:::

````md
:::struktolab{colorMode="greyscale"}
```
if x > 0:
    output("positiv")
else:
    output("not positiv")
```
:::
````

### Black and White

:::struktolab{colorMode="bw"}

```
if x > 0:
    output("positiv")
else:
    output("not positiv")
```

:::

````md
:::struktolab{colorMode="bw"}
```
if x > 0:
    output("positiv")
else:
    output("not positiv")
```
:::
````
