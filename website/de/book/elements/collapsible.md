---
name: Klappkasten
lang: de
---

# Klappkasten

Wenn du zusätzlichen Inhalt anzeigen möchtest, der nicht direkt auf den ersten
Blick sichtbar sein soll, dann kannst du einen Klappkasten verweden. Klappkästen eignen sich zum Beispiel für Hinweise. Sie können auch verschachtelt werden.

```md
::::collapsible{title="Hallo"}

Das ist ein Text.

:::collapsible{title="Verschachtelt"}

Hier ist ein weitere Klappkasten

:::

Klappkästen können auch nacheinander gesetzt werden.

:::collapsible{title="Mit einem Bild"}

![](/test.jpg)

::::
```

::::collapsible{title="Hallo"}

Das ist ein Text.

:::collapsible{title="Verschachtelt"}

Hier ist ein weitere Klappkasten

:::

Klappkästen können auch nacheinander gesetzt werden.

:::collapsible{title="Mit einem Bild"}

![](/test.jpg)

::::

Du kannst Klappkästen auch synchronisieren, wenn sie die gleiche ID besitzen.

```md
:::collapsible{title="Klappkasten 0" id="synced"}

Dies ist ein synchronisierter Klappkasten

:::

Synchronisiert

:::collapsible{title="Klappkasten 1" id="synced"}

Synchronisiert mit dem vorherigen Klappkasten.

:::
```

:::collapsible{title="Klappkasten 0" id="synced"}

Dies ist ein synchronisierter Klappkasten

:::

Synchronisiert

:::collapsible{title="Klappkasten 1" id="synced"}

Synchronisiert mit dem vorherigen Klappkasten.

:::
