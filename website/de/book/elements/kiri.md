---
name: Kiri
permaid: kiri
lang: de
---

# Kiri

Die `kiri`-Direktive bietet einen interaktiven Online-3D-Slicer mit der **Kiri:Moto**-Engine. Kiri:Moto ist ein browserbasierter Slicer für 3D-Druck (FDM, SLA), CNC-Bearbeitung (CAM) und Laserschneiden (LASER).

:::alert{type="info"}
**Benötigt eine Internetverbindung.** Die Kiri:Moto-Engine wird von `grid.space` geladen und erfordert eine Internetverbindung, um zu funktionieren. Für die Offline-Nutzung müssen Sie Kiri:Moto selbst hosten.
:::

## Verwendung

Verwenden Sie die `::kiri`-Direktive mit dem erforderlichen `src`-Attribut, das auf Ihre STL-Modelldatei zeigt:

````md
::kiri{src="./meinmodell.stl" mode="FDM"}
````

## Attribute

| Attribut | Beschreibung | Standard |
|---|---|---|
| `src` | Pfad zur STL-Datei, die geladen werden soll | erforderlich |
| `mode` | Slicer-Modus: `FDM`, `CAM`, `LASER` oder `SLA` | `FDM` |
| `device` | Gerätekonfiguration als JSON-String oder URL zur Geräteprofil | kein |
| `height` | Höhe des Iframes | `500px` |
| `id` | Eindeutige Kennung | automatisch generiert |

## Grundlegendes Beispiel

````md
::kiri{src="./example.stl" mode="FDM"}
````

::kiri{src="./example.stl" mode="FDM"}

## Slicer-Modi

Kiri:Moto unterstützt vier verschiedene Slicer-Modi:

- **FDM** - Fused Deposition Modeling (3D-Druck mit Filament)
- **CAM** - Computer-Aided Manufacturing (CNC-Bearbeitung)
- **LASER** - Laserschneiden/-gravieren
- **SLA** - Stereolithographie (Harzdruck)

### FDM-Modus (Standard)

Für den 3D-Druck mit Filament-Druckern:

````md
::kiri{src="./modelle/teil.stl" mode="FDM"}
````

### CAM-Modus

Für CNC-Bearbeitung:

````md
::kiri{src="./modelle/teil.stl" mode="CAM"}
````

### LASER-Modus

Für Laserschneiden:

````md
::kiri{src="./modelle/ausschnitt.stl" mode="LASER"}
````

### SLA-Modus

Für Harz-3D-Druck:

````md
::kiri{src="./modelle/modell.stl" mode="SLA"}
````

## Gerätekonfiguration

Sie können ein Geräteprofil angeben, um den Slicer für Ihre spezifische Maschine zu konfigurieren. Geräteprofile können als JSON-String oder als URL zu einer Gerätekonfigurationsdatei bereitgestellt werden.

### Verwendung einer JSON-Gerätekonfiguration

Die Gerätekonfiguration folgt dem Kiri:Moto-Geräteprofil-Format:

```md
::kiri{
  src="./modell.stl",
  mode="FDM",
  device='{"mode":"FDM","deviceName":"Creality.Ender.3","bedWidth":220,"bedDepth":220,"bedHeight":2.5,"maxHeight":300}'
}
```

### Beispiel-Gerätekonfiguration (FDM)

Hier ist eine Beispiel-FDM-Gerätekonfiguration basierend auf dem Creality Ender 3:

```json
{
  "mode": "FDM",
  "deviceName": "Creality.Ender.3",
  "bedHeight": 2.5,
  "bedWidth": 220,
  "bedDepth": 220,
  "bedRound": false,
  "maxHeight": 300,
  "originCenter": false,
  "extrudeAbs": true,
  "extruders": [{
    "extFilament": 1.75,
    "extNozzle": 0.4,
    "extSelect": ["T0"]
  }]
}
```

### Verwendung einer Gerätekonfigurations-URL

```md
::kiri{src="./modell.stl" mode="FDM" device="https://beispiel.com/geraete/ender3.json"}
```

## Benutzerdefinierte Abmessungen

Sie können die Größe des Kiri-Viewers anpassen:

````md
::kiri{src="./modell.stl" height="600px"}
````

## Tipps

1. **Modellvorbereitung**: Stellen Sie sicher, dass Ihre STL-Dateien vor dem Laden in Kiri:Moto richtig ausgerichtet und skaliert sind.

2. **Dateigröße**: Große STL-Dateien können länger zum Laden und Schneiden benötigen. Erwägen Sie, komplexe Modelle für bessere Leistung zu vereinfachen.

3. **Browser-Unterstützung**: Kiri:Moto funktioniert in modernen Browsern, die WebAssembly und Web Worker unterstützen.

4. **CORS**: STL-Dateien müssen über CORS-Header zugänglich sein, wenn sie von einer anderen Domain geladen werden.

5. **Relative Pfade**: Relative Pfade im `src`-Attribut werden basierend auf der Konfiguration Ihrer Website aufgelöst.

## Einschränkungen

- Benötigt Internetverbindung, um die Kiri:Moto-Engine von grid.space zu laden
- STL-Dateien müssen über HTTP/HTTPS mit entsprechenden CORS-Headern zugänglich sein
- Gerätekonfigurationen müssen gültiges JSON sein
- Die Slicing-Pipeline wird automatisch ausgeführt, wenn das Modell geladen wird
