---
name: Excalidraw
lang: de
keywords:
  - excalidraw
---

# Excalidraw

Excalidraw ist ein hervoragendes Tool, welches ein interaktives Whiteboard
bereitsstellt, welches zum Zeichen von Diagrammen mit einem von hand
gezeichneten Stil benutzt werden kann.

Du kannst [https://excalidraw.com/](https://excalidraw.com/) verwenden, deine
Zeichnung als JSON-Datei herunterladen, in den public-Ordner legen und ein
Excalidraw Element erstellen (siehe unten).

Das Excalidraw Element akzeptiert folgende Argumente:

- **src**: Der Pfad zur Excalidraw-Datei.
- **aspectRatio**: Um dein Excalidraw auf jedem Gerät schön anzeigen zu lassen, musst du ein Seitenverhältnis definieren. Zum Beispiel: "16/9", "4/3", "1/1".
- **autoZoom**: Standardmäßig wird dein Excalidraw so anzeigt, dass alles zu sehen ist, damit auch auf kleinen Geräten dein Excalidraw gut funktioniert. Diese Verhalten kannst du hier deaktivieren.
- **edit**: Erlaubt das Bearbeiten des Excalidraw.
- **id**: Schlüssel, unter dem die Zeichnung der Lesenden gespeichert wird. Setze ihn, wenn zwei Zeichnungen auf einer Seite dieselbe `src` verwenden. Standardmäßig wird er erzeugt.

Mit `edit=true` wird die Zeichnung der Lesenden im Browser gespeichert. Hat das
Element eine `src`, bietet das Excalidraw-Menü **Auf Vorlage zurücksetzen** an:
Die Änderungen werden verworfen und die Datei aus `src` neu geladen.

Der Button oben rechts zeigt die Zeichnung im Vollbild.

:::alert{info}
autoZoom funktioniert nicht, wenn du deine Datei von excalidraw.com heruntergeladen hat, da diese Datei nicht die originalen Dimensionen enthält.
:::

```md
::excalidraw{src="/excalidraw/hyperbook.excalidraw" aspectRatio="4/3"}

::excalidraw{src="/excalidraw/hyperbook.excalidraw" aspectRatio="4/3" autoZoom=false}

::excalidraw{src="/excalidraw/hyperbook.excalidraw" aspectRatio="4/3" autoZoom=false edit=true}
```

::excalidraw{src="/excalidraw/hyperbook.excalidraw" aspectRatio="4/3"}

::excalidraw{src="/excalidraw/hyperbook.excalidraw" aspectRatio="4/3" autoZoom=false}

:::alert{info}
Versichere dich, dass du die richtige Sprache in der `hyperbook.json` gesetzt hast, anderenfalls wird Excalidraw auf Englisch angezeigt.
:::

::excalidraw{src="/excalidraw/hyperbook.excalidraw" aspectRatio="4/3" autoZoom=false edit=true}

## Bibliotheken hinzufügen

Wenn du Bibliotheken hinzufügen möchtest, musst du diese von https://libraries.excalidraw.com herunterladen und über das Buch-Icon importieren.

## Konfiguration

Du kannst die Standardwerte des Excalidraw-Elements in der `hyperbook.json` ändern.

```json
{
  "elements": {
    "excalidraw": {
      "aspectRatio": "4/3",
      "autoZoom": true,
      "edit": false
    }
  }
}
```
