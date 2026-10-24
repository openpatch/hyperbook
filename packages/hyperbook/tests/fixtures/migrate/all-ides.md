---
name: Old syntax
---

# All IDEs in their old syntax

:::pyide{packages="numpy"}

```python
print(1)
```

```python test
#SCRIPT#
print("ok")
```

:::

::pyide{src="script.py"}

:::p5{height=400 editor=true}

```js
function setup() { createCanvas(100, 100); }
```

:::

::p5{src="sketch.js"}

::p5{src="sketch.js"}

:::openscad

@file dest="/input/model.stl" src="model.stl"

```scad
import("/input/model.stl");
```

:::

:::typst{mode="edit"}

@source dest="other.typ" src="other.typ"

```typ
#include "other.typ"
```

```typ chapter.typ
= Chapter
```

:::
