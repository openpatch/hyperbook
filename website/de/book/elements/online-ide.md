---
name: Online IDE
lang: de
---

Java-ähnliche Programmiersprache (Compiler, Interpreter, Debugger) mit IDE, die
komplett im Browser ausgeführt wird.

Das Online-IDE element akzeptiert folgende Parameter:

- **fileList**: Dateiliste links.
- **console**: falls mit unterem Panel: mit/ohne Console-Tab.
- **pCode**: falls mit unterem Panel: mit/ohne PCode-Tab.
- **bottomPanel**: mit unterem Panel.
- **errorList**: falls mit unterem Panel: mit/ohne Fehlerliste.
- **height**: Höhe des Editors. Standardwert 600px.
- **speed**: Geschwindigkeit in Steps/s. Standardwert 1000.
- **libraries**: Komma-getrennte Liste der zu ladenden Bibliotheken, z.B. `scratch`.

(See: https://github.com/martin-pabst/Online-IDE-new-compiler).

:::onlineide

````markdown Ein Hinweis
## Tipp:

Tipps werden in einer einfachen Markdown-Syntax
verfasst, die **Fettschrift** u.ä. ermöglicht, aber
auch Syntax-Highlighting im Fließtext (`class Quadrat extends Rectangle { }`) und in ganzen Absätzen:

```

double v = Math.random()\*8 + 2; // Betrag der Geschwindigkeit zwischen 2 und 10

double w = Math.random()*2*Math.PI; // Winkel zwischen 0 und 2\*PI

vx = v \* Math.cos(w);

vy = v \* Math.sin(w);
```
````

```java Feuerwerk.java

new Feuerwerk();

class Feuerwerk extends Actor {

   public void act() {
      if(Math.random() < 0.03) {

         int funkenzahl = Math.floor(Math.random() * 50 + 30);
         int farbe = Color.randomColor(128);

         double x = Math.random() * 400 + 200;
         double y = Math.random() * 600;
         double lebensdauer = 60 + Math.random() * 60;
         for (int i = 0; i < funkenzahl; i++) {
            new Funke(x, y, farbe, lebensdauer);
         }
         Sound.playSound(Sound.cannon_boom);

      }
   }

}

class Funke extends Circle {
   double vx;
   double vy;
   double lebensdauer;           // lebensdauer in 1/30 s

   Funke(double x, double y, int farbe, double lebensdauer) {
      super(x, y, 4);
      double winkel = Math.random() * 2 * Math.PI;
      double v = Math.random() * 15 + 5;
      vx = v * Math.cos(winkel);
      vy = v * Math.sin(winkel);
      setFillColor(farbe);
      this.lebensdauer = lebensdauer;
   }

   public void act() {
      lebensdauer--;
      move(vx, vy);
      vy = vy + 0.2;
      if(lebensdauer < 30) {
         setAlpha(lebensdauer / 30);
      }
      if(isOutsideView() || lebensdauer < 0) {
         destroy();
      }
   }

}

```

:::

`````markdown
:::onlineide

````markdown A Hint
## Tip:

Tipps werden in einer einfachen Markdown-Syntax
verfasst, die **Fettschrift** u.ä. ermöglicht, aber
auch Syntax-Highlighting im Fließtext (`class Quadrat extends Rectangle { }`) und in ganzen Absätzen:

```

double v = Math.random()\*8 + 2; // Amount of speed between 2 and 10

double w = Math.random()*2*Math.PI; // angle between 0 and 2\*PI

vx = v \* Math.cos(w);

vy = v \* Math.sin(w);

```
````

```java Feuerwerk.java

new Feuerwerk();

class Feuerwerk extends Actor {

   public void act() {
      if(Math.random() < 0.03) {

         int funkenzahl = Math.floor(Math.random() * 50 + 30);
         int farbe = Color.randomColor(128);

         double x = Math.random() * 400 + 200;
         double y = Math.random() * 600;
         double lebensdauer = 60 + Math.random() * 60;
         for (int i = 0; i < funkenzahl; i++) {
            new Funke(x, y, farbe, lebensdauer);
         }
         Sound.playSound(Sound.cannon_boom);

      }
   }

}

class Funke extends Circle {
   double vx;
   double vy;
   double lebensdauer;           // lebensdauer in 1/30 s

   Funke(double x, double y, int farbe, double lebensdauer) {
      super(x, y, 4);
      double winkel = Math.random() * 2 * Math.PI;
      double v = Math.random() * 15 + 5;
      vx = v * Math.cos(winkel);
      vy = v * Math.sin(winkel);
      setFillColor(farbe);
      this.lebensdauer = lebensdauer;
   }

   public void act() {
      lebensdauer--;
      move(vx, vy);
      vy = vy + 0.2;
      if(lebensdauer < 30) {
         setAlpha(lebensdauer / 30);
      }
      if(isOutsideView() || lebensdauer < 0) {
         destroy();
      }
   }

}

```

:::
`````

## Mit anderen Bibliotheken

| Bibliothek | Parameter | Beschreibung |
| --- | --- | --- |
| Abiturklassen NRW | libraries="nrw" | Klassenbibliothek zur Verwendung im Zentralabitur Nordrhein-Westfalen |
| Graphics and Games Library | libraries="gng" | Graphische Klassenbibliothek für die bayerischen Informatikbücher des Cornelsen-Verlages |
| Abiturklassen Niedersachsen | libraries="niedersachsen" | Klassenbibliothek zur Verwendung im Abitur Niedersachsen |
| Scratch for Java | libraries="scratch" | Scratch-artige Klassenbibliothek (Stage, Sprite, Kostüme, Klänge) — Port von [org.openpatch.scratch](https://scratch4j.openpatch.org) |

:::onlineide{height="500px" console=false libraries="nrw"}

```java Test.java

var l = new List<Integer>();
l.append(1);

```

:::

````
:::onlineide{height="500px" console=false libraries="nrw"}

```java Test.java

var l = new List<Integer>();
l.append(1);

```

:::
````

### Scratch for Java

Mit `libraries="scratch"` stehen die Klassen von
[Scratch for Java](https://scratch4j.openpatch.org) zur Verfügung: `Stage`,
`Sprite`, `AnimatedSprite`, `UISprite`, `Pen`, `Text`, `Camera`, `Timer` und der
Rest der Bibliothek. Programme für die Desktop-Bibliothek laufen unverändert im
Browser, mit zwei Unterschieden:

- Kein `import org.openpatch.scratch.*;` — die Online IDE kennt keine Pakete,
  alle Klassen sind sofort verfügbar.
- Alles, was nur ein Desktop-Programm kann (Shader, Pixelzugriff, Aufnahmen,
  Dateisystem, Tiled-Karten, Vollbild), lässt sich übersetzen, meldet aber in
  der Ausgabe, dass es nichts tut.

Die 841 Kostüme, 266 Klänge und die Hintergründe der Bibliothek sind enthalten,
ein Beispiel braucht also keine eigenen Dateien. Alle Kostüme sind auf der Seite
[Sprites](https://scratch4j.openpatch.org/sprites) der Scratch-for-Java-Dokumentation
zu sehen.

Im folgenden Beispiel läuft der Hase dem Mauszeiger nach und spielt einen Klang,
sobald er die Möhre erreicht.

:::onlineide{height="500px" libraries="scratch"}

```java MeineBuehne.java

new MeineBuehne();

class MeineBuehne extends Stage {

   MeineBuehne() {
      super(480, 360);
      addBackdrop("background");
      add(new Hase());
      add(new Moehre());
   }

}

class Hase extends Sprite {

   public void whenAddedToStage() {
      addCostume("bunny1_walk1");
      addCostume("bunny1_walk2");
      addSound("handleCoins");
      setSize(60);
      setRotationStyle(RotationStyle.LEFT_RIGHT);
      setPosition(-180, -40);
      say("Beweg die Maus!", 2000);
   }

   public void run() {
      if (distanceToMousePointer() > 10) {
         pointTowardsMousePointer();
         move(2);
         if (getTimer().everyMillis(150)) {
            nextCostume();
         }
      }
      if (isTouchingSprite(Moehre.class)) {
         playSound("handleCoins");
         getTouchingSprite(Moehre.class).goToRandomPosition();
      }
   }

   public void whenClicked() {
      say("Hopp!", 1000);
   }

}

class Moehre extends Sprite {

   public void whenAddedToStage() {
      addCostume("carrot");
      setSize(50);
      setPosition(120, -40);
   }

   public void run() {
      turnRight(1);
   }

}

```

:::

`````markdown
:::onlineide{height="500px" libraries="scratch"}

```java MeineBuehne.java

new MeineBuehne();

class MeineBuehne extends Stage {

   MeineBuehne() {
      super(480, 360);
      addBackdrop("background");
      add(new Hase());
      add(new Moehre());
   }

}

class Hase extends Sprite {

   public void whenAddedToStage() {
      addCostume("bunny1_walk1");
      addCostume("bunny1_walk2");
      addSound("handleCoins");
      setSize(60);
      setRotationStyle(RotationStyle.LEFT_RIGHT);
      setPosition(-180, -40);
      say("Beweg die Maus!", 2000);
   }

   public void run() {
      if (distanceToMousePointer() > 10) {
         pointTowardsMousePointer();
         move(2);
         if (getTimer().everyMillis(150)) {
            nextCostume();
         }
      }
      if (isTouchingSprite(Moehre.class)) {
         playSound("handleCoins");
         getTouchingSprite(Moehre.class).goToRandomPosition();
      }
   }

   public void whenClicked() {
      say("Hopp!", 1000);
   }

}

class Moehre extends Sprite {

   public void whenAddedToStage() {
      addCostume("carrot");
      setSize(50);
      setPosition(120, -40);
   }

   public void run() {
      turnRight(1);
   }

}

```

:::
`````
