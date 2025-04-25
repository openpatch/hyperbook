---
name: Multievent
permaid: multievent
---

# Multievent

:::alert{info}
The Multievent library originates from [Aufgabenfuchs](https://www.aufgabenfuchs.de/sonstiges/multievent.shtml) and has been adapted for Hyperbook.
:::

With Multievent, 26 different interactive event formats can be implemented on a webpage. This JavaScript searches the document for areas enclosed in double curly braces {{…}}. The enclosed content is transformed into an interactive element. Characters between the opening curly braces determine the result. Below is a list of formats and the corresponding character sequences. For example, a small {r{…}} creates an evaluable radio button in front of the enclosed term (see below).

## Feedback

For tasks that are evaluated, the following encodings can be added:

```md
:::multievent
{H{Hint displayed after evaluation if the task is correctly evaluated.}}
{h{Hint displayed after evaluation if the task is incorrectly evaluated.}}
:::
```

:::multievent
{H{Hint displayed after evaluation if the task is correctly evaluated.}}
{h{Hint displayed after evaluation if the task is incorrectly evaluated.}}
:::

## Task 1

Click on the fastest land animal in the world.

Syntax: {r1{, {r2{, {r3{ (small r with number)

Result: Radio button on the left (The exclamation mark ! indicates the correct term. Related buttons share the same number.)

```md
:::multievent
{r1{Leopard}}   {r1{!Cheetah}}   {r1{Gazelle}}   {r1{Ostrich}}   {r1{Greyhound}}
:::
```

:::multievent
{r1{Leopard}}   {r1{!Cheetah}}   {r1{Gazelle}}   {r1{Ostrich}}   {r1{Greyhound}}
:::

## Task 2

Click on the largest marine animal below.

Syntax: {R1{, {R2{, {R3{ (capital R with number)

Result: Radio button on the right (The exclamation mark ! indicates the correct term. Related buttons share the same number.)

```md
:::multievent
{R1{!Blue Whale}}   {R1{Sperm Whale}}   {R1{Giant Squid}}   {R1{Basking Shark}}   {R1{Whale Shark}}
:::
```

:::multievent
{R1{!Blue Whale}}   {R1{Sperm Whale}}   {R1{Giant Squid}}   {R1{Basking Shark}}   {R1{Whale Shark}}
:::

## Task 3

Click on all mammals. As long as not all boxes are correctly checked, magnifying glasses will appear next to the boxes after evaluation.

Syntax: {c{ (small c) To group tasks: {c1{; {c2{ ...

Result: Checkbox on the left (The exclamation mark ! indicates a correct term.)

```md
:::multievent
{c{!Gazelle}}   {c{!Mouse}}   {c{Giant Squid}}   {c{Ostrich}}   {c{!Greyhound}}
:::
```

:::multievent
{c{!Gazelle}}   {c{!Mouse}}   {c{Giant Squid}}   {c{Ostrich}}   {c{!Greyhound}}
:::

## Task 4

Click on all freshwater fish. As long as not all boxes are correctly checked, magnifying glasses will appear next to the boxes after evaluation.

Syntax: {C{ (capital C) To group tasks: {C1{; {C2{ ...

Result: Checkbox on the right (The exclamation mark ! indicates a correct term.)

```md
:::multievent
{C{Cod}}   {C{!Trout}}   {C{!Carp}}   {C{Herring}}   {C{!Pikeperch}}
:::
```

:::multievent
{C{Cod}}   {C{!Trout}}   {C{!Carp}}   {C{Herring}}   {C{!Pikeperch}}
:::

## Task 5

Arrange the saying below correctly.

Syntax: {a{ (small a)

Result: Dropdown without empty selection (The exclamation mark ! indicates a correct term. The vertical bar | separates dropdown options.)

```md
:::multievent
A {a{Duck|Tit|Seagull|!Swallow|Pigeon}} does not make a summer.
:::
```

:::multievent
A {a{Duck|Tit|Seagull|!Swallow|Pigeon}} does not make a summer.
:::

## Task 6

Click on the bird with the largest wingspan.

Syntax: {A{ (capital A)

Result: Dropdown with empty selection (The exclamation mark ! indicates a correct term. The vertical bar | separates dropdown options.)

```md
:::multievent
{A{Andean Condor|Dalmatian Pelican|Marabou Stork|Trumpeter Swan|!Wandering Albatross}}
:::
```

:::multievent
{A{Andean Condor|Dalmatian Pelican|Marabou Stork|Trumpeter Swan|!Wandering Albatross}}
:::

## Task 7

Click on the correct animal.

Syntax: {S1{ (capital S with number S1, S2, S3 ...)

Result: Dropdown (All areas with the same number are collected in the dropdown.)

```md
:::multievent
The {S1{Cuckoo}} and the {S1{Donkey}}, they had a quarrel ...
:::
```

:::multievent
The {S1{Cuckoo}} and the {S1{Donkey}}, they had a quarrel ...
:::

## Task 8

Click on all mammals.

Syntax: {k{ (small k) To group tasks: {k1{; {k2{ ...

Result: Clickable button (The exclamation mark ! indicates a correct term. After correct evaluation, excess terms disappear.)

```md
:::multievent
{k{Cuckoo}} {k{!Donkey}} {k{!Cow}} {k{Fish}}
:::
```

:::multievent
{k{Cuckoo}} {k{!Donkey}} {k{!Cow}} {k{Fish}}
:::

## Task 9

Click on all mammals.

Syntax: {K{ (capital K) To group tasks: {K1{; {K2{ ...

Result: Clickable button (The exclamation mark ! indicates a correct term. After correct evaluation, excess terms remain visible.)

```md
:::multievent
{K{Cuckoo}}, {K{!Donkey}}, {K{!Cow}}, {K{Fish}}
:::
```

:::multievent
{K{Cuckoo}}, {K{!Donkey}}, {K{!Cow}}, {K{Fish}}
:::

## Task 10

Enter the correct animal.

Syntax: {l{ (small l)

Result: Text field with scrambled word as a hint (Case-insensitive.)

```md
:::multievent
All my {l{Ducklings}} are swimming on the lake, ...
:::
```

:::multievent
All my {l{Ducklings}} are swimming on the lake, ...
:::

## Task 11

Enter the correct animal.

Syntax: {L{ (capital L)

Result: Text field with scrambled word as a hint (Case-sensitive.)

```md
:::multievent
On the wall, on the wall lies a little {L{Bug}} ...
:::
```

:::multievent
On the wall, on the wall lies a little {L{Bug}} ...
:::

## Task 12

Enter the correct animal.

Syntax: {t{ (small t)

Result: Empty text field (Case-insensitive.)

```md
:::multievent
The cuckoo and the {t{Donkey}}, they had a quarrel ...
:::
```

:::multievent
The cuckoo and the {t{Donkey}}, they had a quarrel ...
:::

## Task 13

Enter the correct animal.

Syntax: {T{ (capital T)

Result: Empty text field (Case-sensitive.)

```md
:::multievent
Fox, you stole the {T{Goose}}, give it back ...
:::
```

:::multievent
Fox, you stole the {T{Goose}}, give it back ...
:::

## Task 14

How many legs do a farmer, 2 cows, and 3 ducks have together?

Syntax: {z{ (small z)

Result: Empty text field for number input (In the example, 16; 16.0 and 16.00 are considered correct.)

```md
:::multievent
Answer: They have {z{16}} legs.
:::
```

:::multievent
Answer: They have {z{16}} legs.
:::

## Task 15

Enter an odd number < 10.

Syntax: {z{ (small z)

Result: Empty text field for number input from a group of numbers (The vertical bar | separates alternatives. In the example, the numbers 1, 3, 5, 7, and 9 are considered correct.)

```md
:::multievent
Answer: {z{1|3|5|7|9}}
:::
```

:::multievent
Answer: {z{1|3|5|7|9}}
:::

## Task 16

How many legs do a farmer, x cows, and y ducks have together?

Syntax: {X{ with {Z{ (capital X with capital Z)

Result: Differently filled text sections {X{ with adjusted number input values {Z{ (The vertical bar | separates values, which are called sequentially when the square "Enter" arrow ↵ next to the evaluation is clicked.)

```md
:::multievent
How many legs do a farmer, {X{4|2|3|5}} cows, and {X{2|4|5|3}} ducks have together?

Answer: They have {Z{22|18|24|28}} legs.
:::
```

:::multievent
How many legs do a farmer, {X{4|2|3|5}} cows, and {X{2|4|5|3}} ducks have together?

Answer: They have {Z{22|18|24|28}} legs.
:::

## Task 17

Enter the German term.

Syntax: {X{ with {y{ (capital X with small y)

Result: Differently filled text sections {X{ with adjusted text input values {y{ (The vertical bar | separates values, which are called sequentially when the square "Enter" arrow ↵ next to the evaluation is clicked. Case-insensitive.)

```md
:::multievent
English: {X{cat|cow|dog|horse|pig}} → German: {y{Cat|Cow|Dog|Horse|Pig}}
:::
```

:::multievent
English: {X{cat|cow|dog|horse|pig}} → German: {y{Cat|Cow|Dog|Horse|Pig}}
:::

## Task 18

Enter the German term.

Syntax: {X{ with {Y{ (capital X with capital Y)

Result: Differently filled text sections {X{ with adjusted text input values {Y{ (The vertical bar | separates values, which are called sequentially when the square "Enter" arrow ↵ next to the evaluation is clicked. Case-sensitive.)

```md
:::multievent
English: {X{bee|dolphin|eagle|shark|spider}} → German: {Y{Bee|Dolphin|Eagle|Shark|Spider}}
:::
```

:::multievent
English: {X{bee|dolphin|eagle|shark|spider}} → German: {Y{Bee|Dolphin|Eagle|Shark|Spider}}
:::

## Task 19

Take notes.

Syntax: {n{ (small n)

Result: Text area for notes. (For the duration of the browser session, helper texts can be entered in the browser.)

```md
:::multievent
{n{200|22|Notes}} {n{Field Width|Field Height|Text}}
:::
```

:::multievent
{n{200|22|Notes}} {n{Field Width|Field Height|Text}}
:::

## Task 20

Click on the eye for more information.

Syntax: {b{ (small b)

Result: Toggle for hidden help offers. (Clicking on the eye shows or hides the help.)

```md
:::multievent
{b{ Help 1, Help 2, ...}}
:::
```

:::multievent
{b{ Help 1, Help 2, ...}}
:::

## Task 21

Click on the eye for more information.

Syntax: {B{ (capital B)

Result: Indented toggle for hidden help offers. (Clicking on the eye shows or hides the help.)

```md
:::multievent
{B{ Help 1, Help 2, ...}}
:::
```

:::multievent
{B{ Help 1, Help 2, ...}}
:::

## Task 22

Click in the input window and press the correct letters for the searched bird.

Syntax: {v{ (small v)

Result: Word search (The vertical bar | separates the terms.)

```md
:::multievent
{v{Woodpecker|Eagle|Pheasant}}
:::
```

:::multievent
{v{Woodpecker|Eagle|Pheasant}}
:::

## Task 23

Click on the letters of the animals in the word search.

Syntax: {w{ (small w)

Result: Word search (The vertical bar | separates the cells. The double tilde ~~ separates the rows. Uppercase letters - correct; lowercase letters - incorrect.)

```md
:::multievent
{w{
a|M|p|b~~
H|A|H|N~~
d|U|g|d~~
E|S|E|L}}
:::
```

:::multievent
{w{
a|M|p|b~~
H|A|H|N~~
d|U|g|d~~
E|S|E|L}}
:::

## Task 24

Solve the crossword puzzle.

Syntax: {W{ (capital W)

Result: Crossword puzzle (The vertical bar | separates the cells. The double tilde ~~ separates the rows.)

```md
:::multievent
{W{ 
    | | |1| ~~
   2|D|U|C|K~~
    | | |A| ~~
    | | |U| ~~
    | | |B| ~~
    | | |E| }}
:::
```

:::multievent
{W{ 
    | | |1| ~~
   2|D|U|C|K~~
    | | |A| ~~
    | | |U| ~~
    | | |B| ~~
    | | |E| }}
:::

## Combine

The different events can be freely combined.

```md
:::multievent
- a) {r1{!correct}} {r1{wrong}}
- b) {R1{!correct}} {R1{wrong}}
- c) {c{!correct}} {c{wrong}}
- d) {C{!correct}} {C{wrong}}
- e) {a{!correct|wrong}}
- f) {A{!correct|wrong}}
:::
```

:::multievent
- a) {r1{!correct}} {r1{wrong}}
- b) {R1{!correct}} {R1{wrong}}
- c) {c{!correct}} {c{wrong}}
- d) {C{!correct}} {C{wrong}}
- e) {a{!correct|wrong}}
- f) {A{!correct|wrong}}
:::

## Mathematical Formulas

Mathematical formulas can also be used in the events. These are enclosed in curly braces.

Select all irrational numbers.

```md
:::multievent
{c{!$\sqrt{2}$}} {c{!$\pi$}} {c{$\frac{1}{2}$}}
:::
```

:::multievent
{c{!$\sqrt{2}$}} {c{!$\pi$}} {c{$\frac{1}{2}$}}
:::

Select the correct exponent.

:::multievent
2^{a{2|3|!4|8}}^=16
:::
