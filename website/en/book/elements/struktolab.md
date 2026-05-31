---
title: Struktolab
permaid: struktolab
---

# Struktolab

Struktolab allows you to display structograms in your hyperbook. You can use it in view mode to display structograms or in edit mode to create and edit structograms directly in your hyperbook.

For more information on how to use Struktolab, see the [Struktolab documentation](https://struktolab.openpatch.org/documentation.html).

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `mode` | Display mode: `preview` or `edit` | `preview` |
| `scale` | Scale factor for the diagram | `1` |
| `fontSize` | Font size used by Struktolab | `14` |
| `lang` | UI language: `de` or `en` | hyperbook language |
| `colorMode` | Color mode: `color`, `greyscale`, or `bw` | `color` |

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
