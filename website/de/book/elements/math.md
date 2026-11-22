---
name: Mathematik
lang: de
---

# Mathematik

Manchmal wünschst du dir $ \LaTeX $, aber du schreibst ja nur Markdown-Dateien. Kein Problem, Hyperbook unterstützt KaTeX.

```md
$$
f(x) = \int_{-\infty}^\infty\hat f(\xi)\,e^{2 \pi i \xi x}\,d\xi
$$
```

$$
f(x) = \int_{-\infty}^\infty\hat f(\xi)\,e^{2 \pi i \xi x}\,d\xi
$$

Du kannst KaTeX auch in einer Zeile verwenden.

```md
Das ist ein $ \Delta $. :smiley:
```

Das ist ein $ \Delta $. :smiley:

## Mathematik in Überschriften

Mathematik funktioniert auch in Überschriften.

```md
## Die Kosten von $x^2$
```

## Die Kosten von $x^2$

:::alert{info}
Inhaltsverzeichnis, Sprungmarke und Lesezeichen können nur Text anzeigen und
verwenden deshalb den TeX-Quelltext der Formel (`Die Kosten von x^2`).
:::
