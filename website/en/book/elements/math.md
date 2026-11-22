---
name: Math
permaid: math
---

# Math

Sometimes you wished for $ \LaTeX $ but then you remember you are writing in Markdown. No problem, we have added KaTeX support.

```md
$$
f(x) = \int_{-\infty}^\infty\hat f(\xi)\,e^{2 \pi i \xi x}\,d\xi
$$
```

$$
f(x) = \int_{-\infty}^\infty\hat f(\xi)\,e^{2 \pi i \xi x}\,d\xi
$$

You can also use KaTeX inline.

```md
This is a $ \Delta $. :smiley:
```

This is a $ \Delta $. :smiley:

## Math in Headings

Math works in headings too.

```md
## The cost of $x^2$
```

## The cost of $x^2$

:::alert{info}
The table of contents, the link anchor and the bookmark label can only show
text, so they use the TeX source of the formula (`The cost of x^2`).
:::
