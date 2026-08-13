---
name: Geerbte Seite
lang: de
---

# Geerbte Seite

Diese Seite hat kein `protect` in ihrem Frontmatter:

```md
---
name: Geerbte Seite
---
```

Sie ist trotzdem geschützt, weil der Abschnitt um sie herum es ist. Genau
dafür setzt man `protect` auf einen Abschnitt: Du legst das Passwort einmal
fest, und jede Seite, die du später in den Ordner legst, ist abgedeckt, ohne
dass du daran denken musst.

Freigeschaltet wird pro setzender Seite oder pro setzendem Abschnitt, nicht pro
Seite — die Index-Seite des Abschnitts und diese Seite teilen sich eine
Freischaltung. Die Eingabe dort hat also auch diese Seite geöffnet. Leg zehn
weitere Seiten in den Ordner, und sie gehen alle mit derselben Eingabe auf.

## Für eine einzelne Seite abweichen

Geerbt wird nur in ein `protect`, das noch nicht da ist. Eine Seite kann ein
anderes Passwort nehmen:

```md
---
name: Öffentliche Notizen
protect: etwas-anderes
---
```

Eine einzelne Seite innerhalb eines geschützten Abschnitts wieder öffentlich zu
machen, geht nicht. Wenn du das brauchst, verschiebe die Seite aus dem Ordner
heraus.
