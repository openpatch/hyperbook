---
name: Blockflow
lang: de
---

# Blockflow

[Blockflow](https://blockflow.openpatch.org) ist ein Fork von Scratch zum Erstellen von geführten Tutorials. Hyperbook bietet zwei Direktiven zum Einbetten von Blockflow: einen **Player** zum Abspielen und einen **Editor** zum Erstellen von Tutorials.

## Player

Der Blockflow Player bettet einen Player zum Abspielen von Scratch-basierten geführten Tutorials ein.

```md
::blockflow-player{src="https://hyperbook.openpatch.org/elements/platformer.sb3"}
```

::blockflow-player{src="https://hyperbook.openpatch.org/elements/platformer.sb3"}


### Player-Argumente

- **src**: Die URL zu einer `.sb3`-Datei.
- **width**: Die Breite des Players. Standard `100%`.
- **height**: Die Höhe des Players. Standard `600px`.

## Editor

Der Blockflow Editor bettet einen Editor zum Erstellen von Scratch-basierten geführten Tutorials ein. Die einzelnen Schritte können direkt in Markdown definiert werden und die Konfiguration wird automatisch beim Bauen generiert.

### Grundlegende Verwendung

```md
::::blockflow-editor{title="Mein Tutorial" src="./plattformer.sb3"}

:::step{title="Willkommen"}
Das ist der erste Schritt des Tutorials.
:::

:::step{title="Bewege die Katze"}
Benutze den Bewegen-Block, um die Katze 10 Schritte zu bewegen.
:::

::::
```

::::blockflow-editor{title="Mein Tutorial" src="./plattformer.sb3"}

:::step{title="Willkommen"}
Das ist der erste Schritt des Tutorials.
:::

:::step{title="Bewege die Katze"}
Benutze den Bewegen-Block, um die Katze 10 Schritte zu bewegen.
:::

::::

### Schritte

Jeder Schritt wird mit einer `:::step`-Direktive innerhalb des Editor-Blocks definiert. Schritte unterstützen die folgenden Attribute:

- **title**: Der Titel des Schritts.
- **image**: Eine optionale Bild-URL für den Schritt.
- **video**: Eine optionale Video-URL für den Schritt.

Der Textinhalt des Schritts wird als Beschreibung verwendet.

```md
::::blockflow-editor{title="Tutorial" src="./projekt.sb3"}

:::step{title="Willkommen" image="./willkommen.png"}
Willkommen zu diesem Tutorial!
:::

:::step{title="Schau dir das an" video="./demo.mp4"}
Schau dir das Video an, um zu sehen, wie es funktioniert.
:::

::::
```

### Toolbox-Konfiguration

Du kannst einschränken, welche Block-Kategorien und Blöcke im Editor verfügbar sind, indem du die Attribute `categories` und `blocks-<kategorie>` verwendest.

- **categories**: Eine kommagetrennte Liste von Block-Kategorien, z.B. `"motion,events,control,operators"`.
- **blocks-\<kategorie\>**: Eine kommagetrennte Liste von Block-IDs für eine bestimmte Kategorie, z.B. `blocks-motion="motion_movesteps,motion_turnright"`.

```md
::::blockflow-editor{title="Tutorial" src="./projekt.sb3" categories="motion,events,control" blocks-motion="motion_movesteps,motion_turnright,motion_turnleft"}

:::step{title="Schritt 1"}
Probiere die Bewegungsblöcke aus!
:::

::::
```

### UI-Konfiguration

- **allowExtensions**: Ob Scratch-Erweiterungen erlaubt sind. Setze auf `"false"`, um sie zu deaktivieren. Standard ist `true`.

```md
::::blockflow-editor{title="Tutorial" src="./projekt.sb3" allowExtensions="false"}

:::step{title="Schritt 1"}
Los geht's!
:::

::::
```

### Editor-Argumente

- **title**: Der Titel des Tutorials.
- **src**: Der Pfad oder die URL zur `.sb3`-Scratch-Projektdatei.
- **width**: Die Breite des Editors. Standard `100%`.
- **height**: Die Höhe des Editors. Standard `600px`.
- **allowExtensions**: Scratch-Erweiterungen erlauben (`"true"` oder `"false"`).
- **categories**: Kommagetrennte Liste von Toolbox-Kategorien.
- **blocks-\<kategorie\>**: Kommagetrennte Liste von Blöcken für eine Kategorie.
