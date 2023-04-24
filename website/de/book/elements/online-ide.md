---
name: Online IDE
lang: de
---

Java-ähnliche Programmiersprache (Compiler, Interpreter, Debugger) mit IDE, die
komplett im Browser ausgeführt wird.

(See: https://github.com/martin-pabst/Online-IDE).

:::onlineide

````markdown Ein Hinweis
## Tipp:

Tipps werden in einer einfachen Markdown-Syntax
verfasst, die **Fettschrift** u.ä. ermöglicht, aber
auch Syntax-Highlighting im Fließtext (`class Quadrat extends Rectangle { }`)
und in ganzen Absätzen:

/``` (den / weglassen!)

double v = Math.random()\*8 + 2; // Betrag der Geschwindigkeit zwischen 2 und 10

double w = Math.random()*2*Math.PI; // Winkel zwischen 0 und 2\*PI

vx = v \* Math.cos(w);

vy = v \* Math.sin(w);
/``` (den / weglassen!)
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

````markdown
:::onlineide

````markdown A Hint
## Tip:

Tips are written in a simple Markdown syntax which
which allows **boldface** and the like, but also syntax
syntax highlighting in body text (`class square extends rectangle { }`)
and in whole paragraphs:

/``` (omit the /!)

double v = Math.random()\*8 + 2; // Amount of speed between 2 and 10

double w = Math.random()*2*Math.PI; // angle between 0 and 2\*PI

vx = v \* Math.cos(w);

vy = v \* Math.sin(w);

/``` (omit the /!)
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
````
