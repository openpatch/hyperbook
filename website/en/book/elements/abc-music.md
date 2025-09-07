---
name: ABC Music
permaid: abc-music
---

# ABC Music

ABC music is a simple text-based music notation system. It is easy to learn and
use, and it is widely used in the folk music community. You can use it to write
down tunes, and you can also use it to play tunes. The ABC music notation system
is supported by the `abcjs` library, which is integrated into hyperbook.

Learn more about ABC music at [abcnotation.com](http://abcnotation.com/).

````md
```abcjs
X: 1
T: Cooley's
M: 4/4
L: 1/8
K: Emin
|:D2|EB{c}BA B2 EB|~B2 AB dBAG|FDAD BDAD|FDAD dAFD|
```

```abcjs editor
X:1
T: Cooley's Long
M: 4/4
L: 1/8
R: reel
K: Emin
D2|:"Em"EB{c}BA B2 EB|~B2 AB dBAG|"D"FDAD BDAD|FDAD dAFD|
"Em"EBBA B2 EB|B2 AB defg|"D"afe^c dBAF|1"Em"DEFD E2 D2:|2"Em"DEFD E2 gf||
|:"Em"eB B2 efge|eB B2 gedB|"D"A2 FA DAFA|A2 FA defg|
"Em"eB B2 eBgB|eB B2 defg|"D"afe^c dBAF|1"Em"DEFD E2 gf:|2"Em"DEFD E4|]
```
````

```abcjs
X: 1
T: Cooley's
M: 4/4
L: 1/8
K: Emin
|:D2|EB{c}BA B2 EB|~B2 AB dBAG|FDAD BDAD|FDAD dAFD|
```

```abcjs editor
X:1
T: Cooley's Long
M: 4/4
L: 1/8
R: reel
K: Emin
D2|:"Em"EB{c}BA B2 EB|~B2 AB dBAG|"D"FDAD BDAD|FDAD dAFD|
"Em"EBBA B2 EB|B2 AB defg|"D"afe^c dBAF|1"Em"DEFD E2 D2:|2"Em"DEFD E2 gf||
|:"Em"eB B2 efge|eB B2 gedB|"D"A2 FA DAFA|A2 FA defg|
"Em"eB B2 eBgB|eB B2 defg|"D"afe^c dBAF|1"Em"DEFD E2 gf:|2"Em"DEFD E4|]
```
