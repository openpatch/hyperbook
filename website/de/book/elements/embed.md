---
name: Embed
lang: de
---

# Embed

Das embed element hilft beim Einbetten von Inhalten.

Zum Beispiel kann eine Learningapp wie folgt eingebettet werden:

```md
::embed{src="https://learningapps.org/watch?app=15767435"}
```

::embed{src="https://learningapps.org/watch?app=15767435"}

Das embed element akzeptiert die folgenden Argumente:

- **src**: Die URL, die eingebettet werden soll.
- **aspectRatio**: Um dein Embed auf jedem Gerät schön anzeigen zu lassen, musst du ein Seitenverhältnis definieren. Zum Beispiel: "16/9", "4/3", "1/1".
- **height**: Die Höhe des Embeds.
- **width**: Die Breite des Embeds. Standard 100%.
- **allowFullscreen**: Ob es dem Embed erlaubt ist den Vollbildmodus zu aktivieren. Standard true.
