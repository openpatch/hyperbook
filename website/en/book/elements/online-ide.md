---
name: Online IDE
---

Java-like programming language (compiler, interpreter, debugger) with IDE that
runs entirely in the browser.

The Online-IDE element accepts these arguments:

- **fileList**: With file list on the left.
- **console**: With console tab in the bottom panel.
- **pCode**: With PCode tab in the bottom panel.
- **bottomPanel**: With bottom panel.
- **errorList**: With error list in the bottom panel.
- **height**: Height of the editor. Defaults to 600px.
- **speed**: Speed of the execution. Defaults to 1000.
- **url**: The base URL of the embedded files for the Online IDE. Defaults to onlineide.openpatch.org.

(See: https://github.com/martin-pabst/Online-IDE).

:::onlineide{height=500 console=false}

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
:::onlineide{height=500 console=false}

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

## With a custom URL

:::onlineide{height=500 console=false url="https://nrw.onlineide.openpatch.org"}

```java Test.java

var l = new List<Integer>();
l.append(1);

```

:::

````
:::onlineide{height=500 console=false url="https://nrw.onlineide.openpatch.org"}

```java Test.java

var l = new NRWList<Integer>();
l.append(1);

```

:::
````
