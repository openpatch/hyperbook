---
name: Kiri:Moto
permaid: kirimoto
lang: de
---

# Kiri:Moto

:::alert{warn}
**Erfordert eine Netzwerkverbindung.** Kiri:Moto wird zur Laufzeit von `grid.space` geladen und ist nicht im Hyperbook-Build-Output enthalten. Dieses Element funktioniert nicht in Offline- oder netzwerkbeschränkten Umgebungen.
:::

[Kiri:Moto](https://grid.space/kiri) ist ein browserbasierter Slicer für 3D-Drucker, CNC-Fräsen und Laserschneider. Er kann direkt in eine Hyperbook-Seite eingebettet werden.

```md
::kirimoto
```

::kirimoto

## Attribute

| Attribut | Beschreibung | Standard |
|---|---|---|
| `height` | Höhe des eingebetteten Slicers | `calc(100vh - 60px)` |
| `mode` | Startmodus: `FDM`, `CAM`, `LASER` oder `SLA` | — |
| `model` | URL einer STL- oder Modelldatei, die automatisch geladen wird | — |
| `workspace` | URL einer `.kmz`-Workspace-Datei (muss über HTTPS mit `Access-Control-Allow-Origin: *` bereitgestellt werden) | — |
| `settings` | Schlüssel für gespeicherte Einstellungen (z. B. `1qzciqo/3` — erhalten per `U`-Taste in Kiri:Moto) | — |

## Modi

Mit dem Attribut `mode` kann Kiri:Moto in einem bestimmten Modus geöffnet werden.

```md
::kirimoto{mode="FDM"}
```

::kirimoto{mode="FDM"}

## Modell laden

Mit dem Attribut `model` kann automatisch eine STL-Datei geladen werden.

```md
::kirimoto{model="/models/cube.stl"}
```

## Workspace laden

Mit dem Attribut `workspace` kann eine `.kmz`-Workspace-Datei importiert werden, die aus Kiri:Moto exportiert wurde. Die Datei muss über HTTPS bereitgestellt werden und den CORS-Header `Access-Control-Allow-Origin: grid.space` oder `*` haben.

```md
```md
::kirimoto{workspace="./kiri-workspace.kmz"}
```

::kirimoto{workspace="./kiri-workspace.kmz"}
```

## Gespeicherte Einstellungen

Mit dem Attribut `settings` kann eine gespeicherte Konfiguration vorab geladen werden. In Kiri:Moto die Taste `U` drücken, um einen Einstellungsschlüssel zu erhalten:

```md
::kirimoto{settings="1qzciqo/3"}
```

::kirimoto{settings="1qzciqo/3"}

## Globale Konfiguration

In `hyperbook.json` können Standardwerte für alle Kiri:Moto-Elemente festgelegt werden:

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

Wenn das Hyperbook mit einer strikten Content Security Policy ausgeliefert wird, muss das Einbetten von `https://grid.space` erlaubt sein:

```
frame-src https://grid.space;
```
