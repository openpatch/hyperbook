---
name: Überschriften
lang: de
---

# Überschriften

```md
# H1

## H2

### H3

#### H4

##### H5

###### H6
```

# H1

## H2

### H3

#### H4

##### H5

###### H6

:::alert{warn}
Bitte verwende die richtige Hierarchie der Überschriften, da diese dazu verwendet wird ein Inhaltsverzeichnis zu erstellen.
:::

## Eigene Ids

Wenn du stabile Links zu den Überschriften haben möchtest, dann kann du eigene Ids setzten:

```md
# Stabile H1 {#stabil}
```

Die Id wird so verwendet, wie sie geschrieben wurde. Ein Link auf `#stabil` funktioniert also weiterhin, wenn sich der Text der Überschrift ändert. Leerzeichen werden durch `-` ersetzt, da eine Id kein Leerzeichen enthalten darf.

# Stabile H1 {#stabil}
