---
name: Kiri:Moto
permaid: kirimoto
---

# Kiri:Moto

:::alert{warn}
**Requires a network connection.** Kiri:Moto is loaded at runtime from `grid.space` and is not bundled with the hyperbook build output. This element will not work in offline or network-restricted environments.
:::

[Kiri:Moto](https://grid.space/kiri) is a browser-based slicer for 3D printers, CNC mills, and laser cutters. It can be embedded directly in a hyperbook page.

```md
::kirimoto
```

::kirimoto

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `height` | Height of the embedded slicer | `calc(100vh - 60px)` |
| `mode` | Starting mode: `FDM`, `CAM`, `LASER`, or `SLA` | — |
| `model` | URL of an STL or model file to load automatically | — |
| `workspace` | URL of a `.kmz` workspace file to import (must be served over HTTPS with `Access-Control-Allow-Origin: *`) | — |
| `settings` | Shared settings key to restore (e.g. `1qzciqo/3` — obtained via the `U` hotkey inside Kiri:Moto) | — |

## Modes

Use the `mode` attribute to open Kiri:Moto in a specific mode.

```md
::kirimoto{mode="FDM"}
```

::kirimoto{mode="FDM"}

## Loading a Model

Use the `model` attribute to automatically load an STL file.

```md
::kirimoto{model="/models/cube.stl"}
```

## Loading a Workspace

Use the `workspace` attribute to import a `.kmz` workspace file exported from Kiri:Moto. The file must be served over HTTPS and have CORS header `Access-Control-Allow-Origin` set to `grid.space` or `*`.

```md
::kirimoto{workspace="./kiri-workspace.kmz"}
```

::kirimoto{workspace="./kiri-workspace.kmz"}

## Shared Settings

Use the `settings` attribute to pre-load a saved configuration. Inside Kiri:Moto press `U` to get a settings key, then pass it here:

```md
::kirimoto{settings="1qzciqo/3"}
```

::kirimoto{settings="1qzciqo/3"}

## Global Configuration

You can set defaults for all Kiri:Moto elements in `hyperbook.json`:

```json
{
  "elements": {
    "kirimoto": {
      "height": "700px",
      "settings": "13b1vam/1"
    }
  }
}
```

## Content Security Policy

If your hyperbook is served with a strict Content Security Policy, you must allow framing from `https://grid.space`:

```
frame-src https://grid.space;
```
