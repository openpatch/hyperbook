---
name: Tabelle
lang: de
---

# Tabelle

Du kannst Tabellen definieren, indem du eine Kombination von
Pipe-Symbolen (|), um Spalten voneinander abzugrenzen und mindestens
drei Bindestrichen, um die Kopfzeilen abzugrenzen, benutzt.

Hier ist ein einfaches Beispiel für eine Tabelle:

```md
| Name | Wert |
| ---- | ---- |
| Rot  | 5    |
| Blau | 4    |
```

| Name | Wert |
| ---- | ---- |
| Rot  | 5    |
| Blau | 4    |

Die Pipe-Symbole (|) müssen nicht untereinander ausgerichtet werden, dies kann aber der Übersichtlichtkeit dienen.

## Ausrichtung

Die Ausrichtung von Spalten kannst du mit Doppelpunkten definieren.

```md
| Linksbündig | Zentiert | Rechtsbündig |
| :---------- | :------: | -----------: |
| Text 1      |   Rot    |         1600 |
| Text 2      |   Blau   |           12 |
| Text 3      |   Grün   |            1 |
```

| Linksbündig | Zentiert | Rechtsbündig |
| :---------- | :------: | -----------: |
| Text 1      |   Rot    |         1600 |
| Text 2      |   Blau   |           12 |
| Text 3      |   Grün   |            1 |

:::alert{info}
Die Breite der Spalten kannst du nicht definieren, diese wird abhändig
vom Inhalt und Webbrowser berechnet.
:::
