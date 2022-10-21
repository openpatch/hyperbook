---
name: Download
lang: de
---

# Download

Du kannst einen Downloadbutton hinzufügen. Wenn die referenzierte Datei nicht
verfügbar ist, dann wird "Offline" angezeigt. Lokale Downloads fangen immer mit
einem Slash (/) an. Diese werde zum public-Ordner verlinkt. Natürlich kannst du
auch auf externe Resourcen verlinken.

```md
:download[Herunterladen]{src="/test.zip"}

:download[Herunterladen]{src="/test.jpg"}
```

Dieser Download referenziert die Datei `test.zip`, welche leider nicht vorhanden ist.

:download[Herunterladen]{src="/test.zip"}

Dieser Download referenziert die Datei `test.jpg` im public-Ordner.

:download[Herunterladen]{src="/test.jpg"}

:::alert{info}
Wenn dein Hyperbook die [basePath](/configuration/book) Option verwendet, dann wird diese automatisch hinzugefügt.
:::
