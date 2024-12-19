---
name: ABC Musik
permaid: abc-music
lang: de
---

# ABC Musik

ABC Musik ist ein einfaches textbasiertes Musiknotensystem. Es ist leicht zu lernen und zu verwenden und wird in der Folk-Musik-Community weit verbreitet. Sie können es verwenden, um Melodien aufzuschreiben, und Sie können es auch verwenden, um Melodien abzuspielen. Das ABC-Musik-Notationssystem wird von der `abcjs`-Bibliothek unterstützt, die in Hyperbook integriert ist.

Erfahren Sie mehr über ABC Musik auf [abcnotation.com](http://abcnotation.com/).

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
L: 1/8\nR: reel\nK: Emin
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
L: 1/8\nR: reel\nK: Emin
D2|:"Em"EB{c}BA B2 EB|~B2 AB dBAG|"D"FDAD BDAD|FDAD dAFD|
"Em"EBBA B2 EB|B2 AB defg|"D"afe^c dBAF|1"Em"DEFD E2 D2:|2"Em"DEFD E2 gf||
|:"Em"eB B2 efge|eB B2 gedB|"D"A2 FA DAFA|A2 FA defg|
"Em"eB B2 eBgB|eB B2 defg|"D"afe^c dBAF|1"Em"DEFD E2 gf:|2"Em"DEFD E4|]
```