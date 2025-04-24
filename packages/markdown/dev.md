---
name: Web IDE
permaid: webide
lang: de 
---

## H5P

## Aufgabe 1

Klick das schnellste Landtier der Welt an?

Syntax: {r1{, {r2{, {r3{ (kleines r mit Zahl)

Ergebnis: Radiobutton links (Das Ausrufezeichen ! kennzeichnet den richtigen Begriff. Bezugnehmende Buttons haben die gleiche Zahl.)

```md
:::multievent
{r1{Leopard}}   {r1{!Gepard}}   {r1{Gazelle}}   {r1{Strauß}}   {r1{Windhund}}
:::
```

:::multievent
{r1{Leopard}}   {r1{!Gepard}}   {r1{Gazelle}}   {r1{Strauß}}   {r1{Windhund}}
:::

## Aufgabe 2

Klick unten den größten Meeresbewohner an?

Syntax: {R1{, {R2{, {R3{ (großes R mit Zahl)

Ergebnis: Radiobutton rechts (Das Ausrufezeichen ! kennzeichnet den richtigen Begriff. Bezugnehmende Buttons haben die gleiche Zahl.)


```md
:::multievent
{R1{!Blauwal}}   {R1{Pottwal}}   {R1{Riesenkalmar}}   {R1{Riesenhai}}   {R1{Walhai}}
:::
```

:::multievent
{R1{!Blauwal}}   {R1{Pottwal}}   {R1{Riesenkalmar}}   {R1{Riesenhai}}   {R1{Walhai}}
:::

## Aufgabe 3

Klicke alle Säugetiere an. Solange nicht alle Boxen richtig angekreuzt sind, erscheinen Lupen neben den Boxen nach der Auswertung.

Syntax: {c{ (kleines c) Um Aufgaben zu gruppieren: {c1{; {c2{ ...

Ergebnis: Checkbox links (Das Ausrufezeichen ! kennzeichnet einen richtigen Begriff)

```md
:::multievent
{c{!Gazelle}}   {c{!Maus}}   {c{Riesenkalmar}}   {c{Strauß}}   {c{!Windhund}}
:::
```

:::multievent
{c{!Gazelle}}   {c{!Maus}}   {c{Riesenkalmar}}   {c{Strauß}}   {c{!Windhund}}
:::

## Aufgabe 4

Klick alle Süßwasserfische an. Solange nicht alle Boxen richtig angekreuzt sind, erscheinen Lupen neben den Boxen nach der Auswertung.

Syntax: {C{ (großes C) Um Aufgaben zu gruppieren: {C1{; {C2{ ...

Ergebnis: Checkbox rechts (Das Ausrufezeichen ! kennzeichnet einen richtigen Begriff.)

```md
:::multievent
{C{Dorsch}}   {C{!Forelle}}   {C{!Karpfen}}   {C{Hering}}   {C{!Zander}}
:::
```

:::multievent
{C{Dorsch}}   {C{!Forelle}}   {C{!Karpfen}}   {C{Hering}}   {C{!Zander}}
:::

## Aufgabe 5

Stelle die Redewendung unten richtig.

Syntax: {a{ (kleines a)

Ergebnis: Auswahlfeld ohne Leerauswahl (Das Ausrufezeichen ! kennzeichnet einen richtigen Begriff. Der senkrechte Strich | trennt Auswahlfelder.)

```md
:::multievent
Eine {a{Ente|Meise|Möwe|!Schwalbe|Taube}} macht noch keinen Sommer.
:::
```

:::multievent
Eine {a{Ente|Meise|Möwe|!Schwalbe|Taube}} macht noch keinen Sommer.
:::

## Aufgabe 6


Klicke den Vogel mit der größten Spannweite an.

Syntax: {A{ (großes A)

Ergebnis: Auswahlfeld mit Leerauswahl (Das Ausrufezeichen ! kennzeichnet einen richtigen Begriff. Der senkrechte Strich | trennt Auswahlfelder.)

```md
:::multievent
{A{Andenkondor|Krauskopfpelikan|Marabu-Storch|Trompeterschwan|!Wanderalbatros}}
:::
```

:::multievent
{A{Andenkondor|Krauskopfpelikan|Marabu-Storch|Trompeterschwan|!Wanderalbatros}}
:::

## Aufgabe 7

Klicke das richtige Tier an.

Syntax: {S1{ (großes S mit Nummer S1, S2, S3 ...)

Ergebnis: Auswahlfeld (Alle Bereiche mit identischer Nummer werde im Auswahlfeld gesammelt.)

```md
:::multievent
Der {S1{Kuckuck}} und der {S1{Esel}}, die hatten einen Streit ...
:::
```

:::multievent
Der {S1{Kuckuck}} und der {S1{Esel}}, die hatten einen Streit ...
:::

## Aufgabe 8

Klicke alle Säugetiere an.

Syntax: {k{ (kleines k) Um Aufgaben zu gruppieren: {k1{; {k2{ ...

Ergebnis: Anklickbarer Button (Das Ausrufezeichen ! kennzeichnet einen richtigen Begriff. Nach korrekter Auswertung verschwinden überschüssige Begriffe.)

```md
:::multievent
{k{Kuckuck}} {k{!Esel}} {k{!Kuh}} {k{Fisch}}
:::
```

:::multievent
{k{Kuckuck}} {k{!Esel}} {k{!Kuh}} {k{Fisch}}
:::

## Aufgabe 9

Klicke alle Säugetiere an.

Syntax: {K{ (großes K) Um Aufgaben zu gruppieren: {K1{; {K2{ ...

Ergebnis: Anklickbarer Button (Das Ausrufezeichen ! kennzeichnet einen richtigen Begriff. Nach korrekter Auswertung bleiben überschüssige Begriffe sichtbar.)

```md
:::multievent
{K{Kuckuck}}, {K{!Esel}}, {K{!Kuh}}, {K{Fisch}}
:::
```

:::multievent
{K{Kuckuck}}, {K{!Esel}}, {K{!Kuh}}, {K{Fisch}}
:::

## Aufgabe 10

Trage das richtige Tier ein.

Syntax: {l{ (kleines l)

Ergebnis: Textfeld mit Purzelwort als Lösungshilfe (Groß- und Kleinschreibung wird beim Lösen nicht beachtet.)


```md
:::multievent
Alle meine {l{Entchen}} schwimmen auf dem See, ...
:::
```

:::multievent
Alle meine {l{Entchen}} schwimmen auf dem See, ...
:::

## Aufgabe 11

Trage das richtige Tier ein.

Syntax: {L{ (großes L)

Ergebnis: Textfeld mit Purzelwort als Lösungshilfe (Groß- und Kleinschreibung wird beim Lösen beachtet.)

```md
:::multievent
Auf der Mauer, auf der Lauer liegt 'ne kleine {L{Wanze}} ...
:::
```

:::multievent
Auf der Mauer, auf der Lauer liegt 'ne kleine {L{Wanze}} ...
:::

## Aufgabe 12

Trage das richtige Tier ein.

Syntax: {t{ (kleines t)

Ergebnis: Leeres Textfeld (Groß- und Kleinschreibung wird beim Lösen nicht beachtet.)

```md
:::multievent
Der Kuckuck und der {t{Esel}}, die hatten einen Streit ...
:::
```

:::multievent
Der Kuckuck und der {t{Esel}}, die hatten einen Streit ...
:::

## Aufgabe 13

Trage das richtige Tier ein.

Syntax: {T{ (großes T)

Ergebnis: Leeres Textfeld (Groß- und Kleinschreibung wird beim Lösen beachtet.)

```md
:::multievent
Fuchs du hast die {T{Gans}} gestohlen, gib sie wieder her ...
:::
```

:::multievent
Fuchs du hast die {T{Gans}} gestohlen, gib sie wieder her ...
:::

## Aufgabe 14

Wie viele Beine haben ein Bauer, 2 Kühe und 3 Enten zusammen?

Syntax: {z{ (kleines z)

Ergebnis: Leeres Textfeld zur Zahleingabe (Im Beispiel werden 16; 16,0 und 16,00 als richtig gewertet.)


```md
:::multievent
Antwort: Sie haben {z{16}} Beine.
:::
```

:::multievent
Antwort: Sie haben {z{16}} Beine.
:::

## Aufgabe 15

Trage eine ungerade Zahl < 10 ein.

Syntax: {z{ (kleines z)

Ergebnis: Leeres Textfeld zur Zahleingabe aus einer Zahlengruppe (Der senkrechte Strich | trennt Alternativen. Im Beispiel werden die Zahlen 1, 3, 5, 7 und 9 als richtig gewertet.)

```md
:::multievent
Antwort: {z{1|3|5|7|9}}
:::
```

:::multievent
Antwort: {z{1|3|5|7|9}}
:::

## Aufgabe 16

Wie viele Beine haben ein Bauer, x Kühe und y Enten zusammen?

Syntax: {X{ mit {Z{ (großes X mit großem Z)

Ergebnis: Unterschiedlich gefüllte Textabschnitte {X{ mit angepassten Zahleingabewerten {Z{ (Der senkrechte Strich | trennt Werte, die nacheinander aufgerufen werden, sobald der eckige "Enter"-Pfeil ↵ neben der Auswertung geklickt wird.)

```md
:::multievent
Wie viele Beine haben ein Bauer, {X{4|2|3|5}} Kühe und {X{2|4|5|3}} Enten zusammen?

Antwort: Sie haben {Z{22|18|24|28}} Beine.
:::
```

:::multievent
Wie viele Beine haben ein Bauer, {X{4|2|3|5}} Kühe und {X{2|4|5|3}} Enten zusammen?

Antwort: Sie haben {Z{22|18|24|28}} Beine.
:::

## Aufgabe 17

Trage den deutschen Begriff ein.

Syntax: {X{ mit {y{ (großes X mit kleinem y)

Ergebnis: Unterschiedlich gefüllte Textabschnitte {X{ mit angepassten Texteingabewerten {y{ (Der senkrechte Strich | trennt Werte, die nacheinander aufgerufen werden, sobald der eckige "Enter"-Pfeil ↵ neben der Auswertung geklickt wird. Groß- und Kleinschreibung wird beim Lösen nicht beachtet.)

```md
:::multievent
englisch: {X{cat|cow|dog|horse|pig}} → deutsch: {y{Katze|Kuh|Hund|Pferd|Schwein}}
:::
```

:::multievent
englisch: {X{cat|cow|dog|horse|pig}} → deutsch: {y{Katze|Kuh|Hund|Pferd|Schwein}}
:::

## Aufgabe 18

Trage den deutschen Begriff ein.

Syntax: {X{ mit {Y{ (großes X mit großem Y)

Ergebnis: Unterschiedlich gefüllte Textabschnitte {X{ mit angepassten Texteingabewerten {Y{ (Der senkrechte Strich | trennt Werte, die nacheinander aufgerufen werden, sobald der eckige "Enter"-Pfeil ↵ neben der Auswertung geklickt wird. Groß- und Kleinschreibung wird beim Lösen beachtet.)

```md
:::multievent
englisch: {X{bee|dolphin|eagle|shark|spider}} → deutsch: {Y{Biene|Delfin|Adler|Hai|Spinne}}
:::
```

:::multievent
englisch: {X{bee|dolphin|eagle|shark|spider}} → deutsch: {Y{Biene|Delfin|Adler|Hai|Spinne}}
:::

## Aufgabe 19

Mache dir Notizen.

Syntax: {n{ (kleines n)

Ergebnis: Textbereich für Notizen. (Für die Dauer der Browsersitzung können im Browser Hilfstexte eingetragen werden.)

```md
:::multievent
{n{200|22|Notizen}} {n{Feldbreite|Feldhöhe|Text}}
:::
```

:::multievent
{n{200|22|Notizen}} {n{Feldbreite|Feldhöhe|Text}}
:::

## Aufgabe 20

Klick auf das Auge für weitere Informationen.

Syntax: {b{ (kleines b)

Ergebnis: Blende für verborgene Hilfsangebote. (Beim Klick auf das Auge erscheint oder verschwindet die Hilfe.)

```md
:::multievent
{b{ Hilfe 1, Hilfe 2, ...}}
:::
```

:::multievent
{b{ Hilfe 1, Hilfe 2, ...}}
:::

## Aufgabe 21

Klick auf das Auge für weitere Informationen.

Syntax: {B{ (großes B)

Ergebnis: Eingerückte Blende für verborgene Hilfsangebote. (Beim Klick auf das Auge erscheint oder verschwindet die Hilfe.)

```md
:::multievent
{B{ Hilfe 1, Hilfe 2, ...}}
:::
```

:::multievent
{B{ Hilfe 1, Hilfe 2, ...}}
:::

## Aufgabe 22

Klick in das Eingabefenster und drücke die richtigen Buchstaben für den gesuchten Vogel.

Syntax: {v{ (kleines v)

Ergebnis: Suchsel (Der senkrechte Strich | trennt die Begriffe.)

```md
:::multievent
{v{Specht|Adler|Fasan}}
:::
```

:::multievent
{v{Specht|Adler|Fasan}}
:::

## Aufgabe 23

Klick die Buchstaben der Tiere im Suchsel an.

Syntax: {w{ (kleines w)

Ergebnis: Suchsel (Der senkrechte Strich | trennt die Zellen. Die doppelte Tilde ~~ die Zeilen. Großbuchstaben - richtig; Kleinbuchstaben - falsch)

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

## Aufgabe 24

Löse das Kreuzworträtsel.

Syntax: {W{ (großes W)

Ergebnis: Kreuzworträtsel(Der senkrechte Strich | trennt die Zellen. Die doppelte Tilde ~~ die Zeilen.)

```md
:::multievent
{W{ 
    | | |1| ~~
   2|E|N|T|E~~
    | | |A| ~~
    | | |U| ~~
    | | |B| ~~
    | | |E| }}
:::
```

:::multievent
{W{ 
    | | |1| ~~
   2|E|N|T|E~~
    | | |A| ~~
    | | |U| ~~
    | | |B| ~~
    | | |E| }}
:::

## Kombinieren

Die unterschiedlichen Events können beliebig miteinander kombiniert werden.

```md
:::multievent
- a) {r1{!richtig}} {r1{falsch}}
- b) {R1{!richtig}} {R1{falsch}}
- c) {c{!richtig}} {c{falsch}}
- d) {C{!richtig}} {C{falsch}}
- e) {a{!richtig|falsch}}
- f) {A{!richtig|falsch}}
:::
```

:::multievent
- a) {r1{!richtig}} {r1{falsch}}
- b) {R1{!richtig}} {R1{falsch}}
- c) {c{!richtig}} {c{falsch}}
- d) {C{!richtig}} {C{falsch}}
- e) {a{!richtig|falsch}}
- f) {A{!richtig|falsch}}
:::

## Mathematische Formeln

In den Events können auch mathematische Formeln verwendet werden. Diese werden in geschweifte Klammern gesetzt.

Wähle alle irrationalen Zahlen aus.

```md
:::multievent
{c{!$\sqrt{2}$}} {c{!$\pi$}} {c{$\frac{1}{2}$}}
:::
```

:::multievent
{c{!$\sqrt{2}$}} {c{!$\pi$}} {c{$\frac{1}{2}$}}
:::

Wähle den richtigen Exponenten.

:::multievent
2^{a{2|3|!4|8}}^=16
:::
