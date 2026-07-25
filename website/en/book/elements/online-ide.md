---
name: Online IDE
permaid: online-ide
---

# Online IDE

Java-like programming language (compiler, interpreter, debugger) with IDE that runs entirely in the browser.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `fileList` | Show the file list on the left | `true` |
| `pCode` | Show the PCode tab in the bottom panel | `false` |
| `bottomPanel` | Show the bottom panel | `true` |
| `errorList` | Show the error list in the bottom panel | `true` |
| `height` | Height of the editor | `calc(100dvh - 80px)` |
| `speed` | Execution speed | `1000` |
| `libraries` | Comma-separated list of libraries to preload, for example `nrw` | - |

(See: https://github.com/martin-pabst/Online-IDE-new-compiler).

:::onlineide

````markdown A Hint
## Tip:

Tips are written in a simple Markdown syntax which
which allows **boldface** and the like, but also syntax
syntax highlighting in body text (`class square extends rectangle { }`)
and in whole paragraphs:

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

`````markdown
:::onlineide

````markdown A Hint
## Tip:

Tips are written in a simple Markdown syntax which
which allows **boldface** and the like, but also syntax
syntax highlighting in body text (`class square extends rectangle { }`)
and in whole paragraphs:

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

## With others libraries

| Library | Parameter | Description |
| --- | --- | --- |
| Abitur classes NRW | libraries="nrw" | Class library for use in the central Abitur of North Rhine-Westphalia |
| Graphics and Games Library | libraries="gng" | Graphical class library for the Bavarian computer science books of the Cornelsen publishing house |
| Abitur classes Lower Saxony | libraries="niedersachsen" | Class library for use in the Abitur Lower Saxony |
| Scratch for Java | libraries="scratch" | Scratch-like class library (Stage, Sprite, costumes, sounds) — a port of [org.openpatch.scratch](https://scratch4j.openpatch.org) |

:::onlineide{height="500px" libraries="nrw"}

```java Test.java

var l = new List<Integer>();
l.append(1);

```

:::

````
:::onlineide{height="500px" libraries="nrw"}

```java Test.java

var l = new List<Integer>();
l.append(1);

```

:::
````

### Scratch for Java

`libraries="scratch"` makes the classes of
[Scratch for Java](https://scratch4j.openpatch.org) available: `Stage`, `Sprite`,
`AnimatedSprite`, `UISprite`, `Pen`, `Text`, `Camera`, `Timer` and the rest of
the library. Programs written for the desktop library run unchanged in the
browser, with two differences:

- No `import org.openpatch.scratch.*;` — the Online IDE has no packages, all
  classes are available right away.
- Everything that only a desktop program can do (shaders, the pixel buffer,
  recording, the file system, Tiled maps, fullscreen) compiles, but reports in
  the output that it does nothing.

The 841 costumes, 266 sounds and the backdrops of the library are bundled, so an
example needs no assets of its own. Browse the costumes on the
[Sprites](https://scratch4j.openpatch.org/sprites) page of the Scratch for Java
documentation.

In the example below the bunny follows the mouse pointer and plays a sound
whenever it reaches the carrot.

:::onlineide{height="500px" libraries="scratch"}

```java MyStage.java

new MyStage();

class MyStage extends Stage {

   MyStage() {
      super(480, 360);
      addBackdrop("background");
      add(new Bunny());
      add(new Carrot());
   }

}

class Bunny extends Sprite {

   public void whenAddedToStage() {
      addCostume("bunny1_walk1");
      addCostume("bunny1_walk2");
      addSound("handleCoins");
      setSize(60);
      setRotationStyle(RotationStyle.LEFT_RIGHT);
      setPosition(-180, -40);
      say("Move your mouse!", 2000);
   }

   public void run() {
      if (distanceToMousePointer() > 10) {
         pointTowardsMousePointer();
         move(2);
         if (getTimer().everyMillis(150)) {
            nextCostume();
         }
      }
      if (isTouchingSprite(Carrot.class)) {
         playSound("handleCoins");
         getTouchingSprite(Carrot.class).goToRandomPosition();
      }
   }

   public void whenClicked() {
      say("Hop!", 1000);
   }

}

class Carrot extends Sprite {

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

```java MyStage.java

new MyStage();

class MyStage extends Stage {

   MyStage() {
      super(480, 360);
      addBackdrop("background");
      add(new Bunny());
      add(new Carrot());
   }

}

class Bunny extends Sprite {

   public void whenAddedToStage() {
      addCostume("bunny1_walk1");
      addCostume("bunny1_walk2");
      addSound("handleCoins");
      setSize(60);
      setRotationStyle(RotationStyle.LEFT_RIGHT);
      setPosition(-180, -40);
      say("Move your mouse!", 2000);
   }

   public void run() {
      if (distanceToMousePointer() > 10) {
         pointTowardsMousePointer();
         move(2);
         if (getTimer().everyMillis(150)) {
            nextCostume();
         }
      }
      if (isTouchingSprite(Carrot.class)) {
         playSound("handleCoins");
         getTouchingSprite(Carrot.class).goToRandomPosition();
      }
   }

   public void whenClicked() {
      say("Hop!", 1000);
   }

}

class Carrot extends Sprite {

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
