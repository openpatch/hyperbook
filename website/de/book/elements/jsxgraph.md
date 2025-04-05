---
name: JSXGraph
permaid: jsxgraph
---

# JSXGraph

JSXGraph ist eine JavaScript-Bibliothek für interaktive Geometrie, Funktionsdarstellung, Diagrammerstellung und andere mathematische Visualisierungen in einem Webbrowser. Sie ist kostenlos und quelloffen und kann verwendet werden, um dynamische und interaktive mathematische Inhalte zu erstellen.

Sie können JSXGraph in Ihr Buch einbetten, indem Sie das `jsxgraph`-Element verwenden. Mit den Attributen `height` und `width` können Sie die Größe des JSXGraph-Boards festlegen. Das Attribut `boundingbox` wird verwendet, um den Begrenzungsrahmen des Boards zu definieren. Die Attribute `axis` und `grid` dienen dazu, die Achsen und das Raster ein- oder auszublenden.

In Ihrem Code müssen Sie die Variable `board` verwenden, um auf das JSXGraph-Board zuzugreifen. Sie können Punkte, Linien, Kurven und andere Elemente auf dem Board mit der Methode `board.create` erstellen. Das erste Argument gibt den Typ des zu erstellenden Elements an, und das zweite Argument ist ein Array von Parametern für das Element.

Die Dokumentation zu JSXGraph finden Sie [hier](https://jsxgraph.org/docs/) und Beispiele [hier](https://jsxgraph.uni-bayreuth.de/share/).

````md

:::jsxgraph{height="500" width="600" boundingbox="[-10,10,14,-10]" axis=false grid=false}

```js

var a = board.create('slider', [[1,8],[5,8],[0,1,4]]);
var b = board.create('slider', [[1,9],[5,9],[0,0.25,4]]);
var c = board.create('curve', [function(phi){return a.Value()+b.Value()*phi; }, [0, 0], 0, 8*Math.PI],
{curveType:'polar', strokewidth:4});

```

:::

````

:::jsxgraph{height="500" width="600" boundingbox="[-10,10,14,-10]" axis=false grid=false}

```js
var a = board.create('slider', [[1,8],[5,8],[0,1,4]]);
var b = board.create('slider', [[1,9],[5,9],[0,0.25,4]]);
var c = board.create('curve', [function(phi){return a.Value()+b.Value()*phi; }, [0, 0], 0, 8*Math.PI],
{curveType:'polar', strokewidth:4});
```

:::

Sie können auch sehr komplexe JSXGraph-Visualisierungen erstellen.

:::jsxgraph{boundingbox="[-1.5,28.5,28.5,-1.5]"}

```js
// Slider definieren, um Parameter der Gleichungen dynamisch zu ändern, und Textelemente erstellen, um sie zu beschreiben
s = board.create(
  "slider",
  [
    [20.0, 26.0],
    [25.0, 26.0],
    [0.0, 0.3, 1.0],
  ],
  { name: "&epsilon;1", strokeColor: "black", fillColor: "black" }
);
st = board.create("text", [20, 25, "Geburtenrate Räuber"], { fixed: true });
u = board.create(
  "slider",
  [
    [20.0, 24.0],
    [25.0, 24.0],
    [0.0, 0.7, 1.0],
  ],
  { name: "&epsilon;2", strokeColor: "black", fillColor: "black" }
);
ut = board.create("text", [20, 23, "Sterberate Räuber"], { fixed: true });

o = board.create(
  "slider",
  [
    [10.0, 26.0],
    [15.0, 26.0],
    [0.0, 0.1, 1.0],
  ],
  { name: "&gamma;1", strokeColor: "black", fillColor: "black" }
);
ot = board.create("text", [10, 25, "Sterberate Beute/pro Räuber"], {
  fixed: true,
});
p = board.create(
  "slider",
  [
    [10.0, 24.0],
    [15.0, 24.0],
    [0.0, 0.3, 1.0],
  ],
  { name: "&gamma;2", strokeColor: "black", fillColor: "black" }
);
pt = board.create("text", [10, 23, "Reproduktionsrate Räuber/pro Beute"], {
  fixed: true,
});

// Dynamischer Anfangswert als Gleiter auf der y-Achse
startpred = board.create("glider", [0, 10, board.defaultAxes.y], {
  name: "Beute",
  strokeColor: "red",
  fillColor: "red",
});
startprey = board.create("glider", [0, 5, board.defaultAxes.y], {
  name: "Räuber",
  strokeColor: "blue",
  fillColor: "blue",
});

// Variablen für die JXG.Curves
var g3 = null;
var g4 = null;

// ODE initialisieren und mit JXG.Math.Numerics.rungeKutta() lösen
function ode() {
  // Auswertungsintervall
  var I = [0, 25];
  // Anzahl der Schritte. 1000 sollten ausreichen
  var N = 1000;

  // Rechte Seite der ODE dx/dt = f(t, x)
  var f = function (t, x) {
    var bpred = s.Value(); //0.3;
    var bprey = u.Value(); //0.7;
    var dpred = o.Value(); //0.1;
    var dprey = p.Value(); //0.3;

    var y = [];
    y[0] = x[0] * (bpred - dpred * x[1]);
    y[1] = -x[1] * (bprey - dprey * x[0]);

    return y;
  };

  // Anfangswert
  var x0 = [startpred.Y(), startprey.Y()];

  // ODE lösen
  var data = JXG.Math.Numerics.rungeKutta("euler", x0, I, N, f);

  // Um die Daten gegen die Zeit zu plotten, benötigen wir die Zeiten, zu denen die Gleichungen gelöst wurden
  var t = [];
  var q = I[0];
  var h = (I[1] - I[0]) / N;
  for (var i = 0; i < data.length; i++) {
    data[i].push(q);
    q += h;
  }

  return data;
}

// Datenpunkte abrufen
var data = ode();

// Daten in Arrays kopieren, um sie mit JXG.Curve zu plotten
var t = [];
var dataprey = [];
var datapred = [];
for (var i = 0; i < data.length; i++) {
  t[i] = data[i][2];
  datapred[i] = data[i][0];
  dataprey[i] = data[i][1];
}

// Räuber plotten
g3 = board.create("curve", [t, datapred], {
  strokeColor: "red",
  strokeWidth: "2px",
});
g3.updateDataArray = function () {
  var data = ode();
  this.dataX = [];
  this.dataY = [];
  for (var i = 0; i < data.length; i++) {
    this.dataX[i] = t[i];
    this.dataY[i] = data[i][0];
  }
};

// Beute plotten
g4 = board.create("curve", [t, dataprey], {
  strokeColor: "blue",
  strokeWidth: "2px",
});
g4.updateDataArray = function () {
  var data = ode();
  this.dataX = [];
  this.dataY = [];
  for (var i = 0; i < data.length; i++) {
    this.dataX[i] = t[i];
    this.dataY[i] = data[i][1];
  }
};
```

:::

