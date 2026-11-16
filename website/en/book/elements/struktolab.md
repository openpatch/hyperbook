---
title: Struktolab
permaid: struktolab
---

# Struktolab

Struktolab allows you to display structograms in your hyperbook. You can use it in view mode to display structograms or in edit mode to create and edit structograms directly in your hyperbook.

For more information on how to use Struktolab, see the [Struktolab documentation](https://struktolab.openpatch.org/documentation.html).

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `mode` | Display mode: `preview` or `edit` | `preview` |
| `scale` | Scale factor for the diagram | `1` |
| `fontSize` | Font size used by Struktolab | `14` |
| `lang` | UI language: `de` or `en` | hyperbook language |
| `colorMode` | Color mode: `color`, `greyscale`, or `bw` | `color` |
| `src` | A structogram file (`.struktolab`, its tree as JSON) instead of a code block, e.g. `::struktolab{src="/loop.struktolab"}` | - |
| `code` | The language the structogram is written in: `pseudocode`, `java`, `python` or `javascript`. A code block's language (` ```java `) sets it too. (`none` hides the code, the older way of saying `hideCode`.) | `pseudocode` |
| `hideCode` | In edit mode, the diagram alone, without the code under it; the language stays. A flag (`{hideCode}`), or `true`/`false`. | off |

## Java, Python and JavaScript

Instead of pseudocode, write the algorithm in Java, Python or JavaScript and give the code block its language. The structogram is built from the code; nothing is translated between languages. Imports, the class, `main` and I/O setup are left out of the diagram. For Java, `IO.readln` and `IO.println` (Java 25) are input and output, as are `Scanner` and `System.out.println`.

:::struktolab

```java
void main() {
    int n = Integer.parseInt(IO.readln("n: "));
    int f = 1;
    for (int i = 2; i <= n; i++) {
        f = f * i;
    }
    IO.println(f);
}
```

:::

````md
:::struktolab
```java
void main() {
    int n = Integer.parseInt(IO.readln("n: "));
    int f = 1;
    for (int i = 2; i <= n; i++) {
        f = f * i;
    }
    IO.println(f);
}
```
:::
````

In edit mode, students write their algorithm in the code box under the diagram and get the structogram as they type. Their code is saved in the browser with the structogram, comments and all.

:::struktolab{mode="edit"}

```python
n = int(input("n: "))
summe = 0
for i in range(1, n + 1):
    summe += i
print(summe)
```

:::

````md
:::struktolab{mode="edit"}
```python
n = int(input("n: "))
summe = 0
for i in range(1, n + 1):
    summe += i
print(summe)
```
:::
````

An empty structogram for students to write in Java: `::struktolab{mode="edit" code="java"}`.

## View

:::struktolab{fontSize=16}

```
if x > 0:
    output("positiv")
else:
    output("not positiv")

```

:::

````md
:::struktolab{fontSize=16}
```
if x > 0:
    output("positiv")
else:
    output("not positiv")

```
:::
````

## Edit

:::struktolab{fontSize=16 mode="edit" scale=2}

```
if x > 0:
    output("positiv")
else:
    output("not positiv")

```

:::

````md
:::struktolab{fontSize=16 mode="edit" scale=2}
```
if x > 0:
    output("positiv")
else:
    output("not positiv")

```
:::
````

### Without the code

`hideCode` shows the diagram alone in edit mode. The language stays: Java's function headers read like Java, and *Show code* in the editor's View brings the code back in that language.

:::struktolab{mode="edit" hideCode}

```java
int twice(int x) {
    return x * 2;
}
```

:::

````md
:::struktolab{mode="edit" hideCode}
```java
int twice(int x) {
    return x * 2;
}
```
:::
````

## Color Modes

### Color

:::struktolab{colorMode="color"}

```
if x > 0:
    output("positiv")
else:
    output("not positiv")
```

:::

````md
:::struktolab{colorMode="color"}
```
if x > 0:
    output("positiv")
else:
    output("not positiv")
```
:::
````

### Greyscale

:::struktolab{colorMode="greyscale"}

```
if x > 0:
    output("positiv")
else:
    output("not positiv")
```

:::

````md
:::struktolab{colorMode="greyscale"}
```
if x > 0:
    output("positiv")
else:
    output("not positiv")
```
:::
````

### Black and White

:::struktolab{colorMode="bw"}

```
if x > 0:
    output("positiv")
else:
    output("not positiv")
```

:::

````md
:::struktolab{colorMode="bw"}
```
if x > 0:
    output("positiv")
else:
    output("not positiv")
```
:::
````
