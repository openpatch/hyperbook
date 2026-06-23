---
name: Kiri
permaid: kiri
---

# Kiri

The `kiri` directive provides an interactive online 3D slicer using the **Kiri:Moto** engine. Kiri:Moto is a browser-based slicer for 3D printing (FDM, SLA), CNC machining (CAM), and laser cutting (LASER).

:::alert{type="info"}
**Requires a network connection.** The Kiri:Moto engine is loaded from `grid.space` and requires internet access to function. For offline use, you would need to self-host Kiri:Moto.
:::

## Usage

Use the `::kiri` directive with the required `src` attribute pointing to your STL model file:

````md
::kiri{src="./mymodel.stl" mode="FDM"}
````

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `src` | Path to the STL file to load | required |
| `mode` | Slicing mode: `FDM`, `CAM`, `LASER`, or `SLA` | `FDM` |
| `device` | Device configuration as JSON string or URL to device profile | none |
| `height` | Height of the iframe | `500px` |
| `id` | Unique identifier | auto-generated |

## Basic Example

````md
::kiri{src="./example.stl" mode="FDM"}
````

::kiri{src="./example.stl" mode="FDM"}

## Slicing Modes

Kiri:Moto supports four different slicing modes:

- **FDM** - Fused Deposition Modeling (3D printing with filament)
- **CAM** - Computer-Aided Manufacturing (CNC machining)
- **LASER** - Laser cutting/engraving
- **SLA** - Stereolithography (resin 3D printing)

### FDM Mode (Default)

For 3D printing with filament-based printers:

````md
::kiri{src="./models/part.stl" mode="FDM"}
````

### CAM Mode

For CNC machining:

````md
::kiri{src="./models/part.stl" mode="CAM"}
````

### LASER Mode

For laser cutting:

````md
::kiri{src="./models/cutout.stl" mode="LASER"}
````

### SLA Mode

For resin 3D printing:

````md
::kiri{src="./models/model.stl" mode="SLA"}
````

## Device Configuration

You can specify a device profile to configure the slicer for your specific machine. Device profiles can be provided as a JSON string or as a URL to a device configuration file.

### Using a JSON Device Configuration

The device configuration follows the Kiri:Moto device profile format:

```md
::kiri{
  src="./model.stl",
  mode="FDM",
  device='{"mode":"FDM","deviceName":"Creality.Ender.3","bedWidth":220,"bedDepth":220,"bedHeight":2.5,"maxHeight":300}'
}
```

### Example Device Configuration (FDM)

Here's an example FDM device configuration based on the Creality Ender 3:

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

### Using a Device Configuration URL

```md
::kiri{src="./model.stl" mode="FDM" device="https://example.com/devices/ender3.json"}
```

## Custom Dimensions

You can customize the size of the Kiri viewer:

````md
::kiri{src="./model.stl" height="600px"}
:::
````

## Tips

1. **Model Preparation**: Ensure your STL files are properly oriented and scaled before loading them into Kiri:Moto.

2. **File Size**: Large STL files may take longer to load and slice. Consider simplifying complex models for better performance.

3. **Browser Support**: Kiri:Moto works in modern browsers that support WebAssembly and Web Workers.

4. **CORS**: STL files must be accessible via CORS headers if loaded from a different domain.

5. **Relative Paths**: Relative paths in the `src` attribute are resolved based on your site's configuration.

## Limitations

- Requires internet connectivity to load the Kiri:Moto engine from grid.space
- STL files must be accessible via HTTP/HTTPS with appropriate CORS headers
- Device configurations must be valid JSON
- The slicing pipeline runs automatically when the model is loaded
