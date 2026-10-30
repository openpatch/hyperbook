# struktolab (structograms / Nassi-Shneiderman)

`:::struktolab` shows a structogram built from pseudocode in a plain fenced block,
or from a `.struktolab` file (the diagram tree as JSON) via `src` — writable with
`write_file`.

```md
:::struktolab{mode="edit"}

```
wiederhole für i = 1 bis 10:
    ausgabe(i)
```

:::
```

Attributes: `mode` (`preview` default, `edit`), `scale`, `fontSize` (default 14),
`lang` (`de`/`en`, UI language), `colorMode` (`color`, `greyscale`, `bw`), `src`.

## Pseudocode syntax

Indentation with **4 spaces** defines nesting. Two keyword languages: **German
(default)** and **English** — pick one and stay consistent within a diagram.

### Statements, input, output

```
// any plain statement (a "task" node)
ergebnis = 1
// input
eingabe("Zahl n")        // input("number n")
// output
ausgabe("Ergebnis")      // output("result")
```

### Branching (if / else)

```
fails x > 0:             // if x > 0:
    ausgabe("positiv")   //     output("positive")
sonst:                   // else:
    ausgabe("negativ")   //     output("not positive")
```

Custom column widths with `[ratio, ratio]` after the condition:
`falls x > 0 [0.7, 0.3]:` — 70% for the true branch, 30% for false.

### Switch / case

```
unterscheide farbe:      // switch color:
fall "rot":              // case "red":
    ausgabe("stopp")     //     output("stop")
fall "grün":             // case "green":
    ausgabe("los")       //     output("go")
sonst:                   // default:
    ausgabe("unbekannt") //     output("unknown")
```

Column widths work here too: `unterscheide farbe [0.4, 0.3, 0.3]:`.

### Loops

```
// count loop (for)
wiederhole für i = 1 bis 10:   // repeat for i = 1 to 10:
    ausgabe(i)                 //     output(i)
// head loop (while)
wiederhole solange x > 0:      // repeat while x > 0:
    x = x - 1                  //     x = x - 1
// foot loop (do-while)
wiederhole:                    // repeat:
    eingabe("Wert")            //     input("value")
solange wert != 0              // while value != 0
```

### Functions

```
funktion factorial(n):       // function factorial(n):
    falls n <= 1:            //     if n <= 1:
        ergebnis = 1         //         result = 1
    sonst:                   //     else:
        ergebnis = n * factorial(n - 1)
```

### Try / catch

```
versuche:                  // try:
    x = parse(eingabe)     //     x = parse(input)
fange Exception e:         // catch Exception e:
    ausgabe("Fehler")      //     output("error")
```

### Line breaks inside a node

Use `\n` in the node text for a manual line break.

## Keyword reference

| Concept | German | English |
|---|---|---|
| If / Else | `falls` / `sonst` | `if` / `else` |
| Loops | `wiederhole` (`für`/`bis`, `solange`, or foot-loop `wiederhole:` … `solange`) | `repeat` (`for`/`to`, `while`, or `repeat:` … `while`) |
| Switch / case / default | `unterscheide` / `fall` / `sonst` | `switch` / `case` / `default` |
| Function | `funktion` | `function` |
| Try / catch | `versuche` / `fange` | `try` / `catch` |
| Input / output | `eingabe` / `ausgabe` | `input` / `output` |
| True / false label | `Wahr` / `Falsch` | `True` / `False` |
