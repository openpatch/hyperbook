---
title: Struktolab
permaid: struktolab
---

# Struktolab

Struktolab ermöglicht es Ihnen, Struktogramme in Ihrem Hyperbook anzuzeigen. Sie können es im Ansichtsmodus verwenden, um Struktogramme anzuzeigen, oder im Bearbeitungsmodus, um Struktogramme direkt in Ihrem Hyperbook zu erstellen und zu bearbeiten.

Für weitere Informationen zur Verwendung von Struktolab siehe die [Struktolab-Dokumentation](https://struktolab.openpatch.org/documentation.html).

## Attribute

- `mode`: "view" | "edit"
- `scale`: number
- `fontSize`: number
- `lang`: "de" | "en" uses the hyperbook language by default
- `colorMode`: "color" | "greyscale" | "bw"
- `src`: eine Struktogramm-Datei (`.struktolab`, der Baum als JSON) statt eines Code-Blocks, z. B. `::struktolab{src="/schleife.struktolab"}`
- `code`: die Sprache, in der das Struktogramm geschrieben ist: `pseudocode`, `java`, `python` oder `javascript`. Im Bearbeitungsmodus blendet `none` den Code unter dem Diagramm aus. Die Sprache eines Code-Blocks (` ```java `) legt sie ebenfalls fest. Standard: `pseudocode`

## Java, Python und JavaScript

Statt Pseudocode kann der Algorithmus in Java, Python oder JavaScript geschrieben werden; dazu bekommt der Code-Block seine Sprache. Das Struktogramm entsteht aus dem Code, zwischen Sprachen wird nichts übersetzt. Imports, die Klasse, `main` und das Einrichten der Ein- und Ausgabe tauchen im Diagramm nicht auf. In Java sind `IO.readln` und `IO.println` (Java 25) Ein- und Ausgabe, ebenso `Scanner` und `System.out.println`.

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

Im Bearbeitungsmodus schreiben Schülerinnen und Schüler ihren Algorithmus in das Codefeld unter dem Diagramm und sehen das Struktogramm beim Tippen entstehen. Ihr Code wird mit dem Struktogramm im Browser gespeichert, samt Kommentaren.

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

Ein leeres Struktogramm, in das Schülerinnen und Schüler Java schreiben: `::struktolab{mode="edit" code="java"}`.

## View

:::struktolab{fontSize=16}

```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")

```

:::

````md
:::struktolab{fontSize=16}
```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")

```
:::
````

## Edit

:::struktolab{fontSize=16 mode="edit" scale=2}

```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")

```

:::

````md
:::struktolab{fontSize=16 mode="edit" scale=2}
```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")

```
:::
````

## Color Modes

### Color

:::struktolab{colorMode="color"}

```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")
```

:::

````md
:::struktolab{colorMode="color"}
```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")
```
:::
````

### Greyscale

:::struktolab{colorMode="greyscale"}

```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")
```

:::

````md
:::struktolab{colorMode="greyscale"}
```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")
```
:::
````

### Black and White

:::struktolab{colorMode="bw"}

```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")
```

:::

````md
:::struktolab{colorMode="bw"}
```
falls x > 0:
    ausgabe("positiv")
sonst:
    ausgabe("nicht positiv")
```
:::
````
