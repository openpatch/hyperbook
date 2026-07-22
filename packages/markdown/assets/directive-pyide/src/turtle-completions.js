import { scriptLooksLikeTurtle } from "./constants.js";

/**
 * Editor completions for the built-in `turtle` module implemented in
 * turtle-ffi.js. Keep this list in sync with the API objects exported there —
 * every entry below has to exist at runtime, or the editor promises something
 * the module cannot deliver.
 *
 * Entries are [name, signature, description]; aliases are listed separately so
 * short forms like `fd` still show what they stand for.
 */

/** Turtle movement and state. */
const TURTLE_MOVE = [
  [
    "forward",
    "forward(distance)",
    "Move the turtle forward by distance, in the direction it is headed.",
  ],
  ["fd", "fd(distance)", "Short form of forward()."],
  [
    "backward",
    "backward(distance)",
    "Move the turtle backward by distance, without changing its heading.",
  ],
  ["bk", "bk(distance)", "Short form of backward()."],
  ["back", "back(distance)", "Short form of backward()."],
  [
    "right",
    "right(angle)",
    "Turn the turtle right (clockwise) by angle units.",
  ],
  ["rt", "rt(angle)", "Short form of right()."],
  [
    "left",
    "left(angle)",
    "Turn the turtle left (counterclockwise) by angle units.",
  ],
  ["lt", "lt(angle)", "Short form of left()."],
  [
    "goto",
    "goto(x, y=None)",
    "Move the turtle to an absolute position. Draws a line if the pen is down.",
  ],
  ["setpos", "setpos(x, y=None)", "Same as goto()."],
  ["setposition", "setposition(x, y=None)", "Same as goto()."],
  [
    "setx",
    "setx(x)",
    "Set the turtle's first coordinate, leaving the second unchanged.",
  ],
  [
    "sety",
    "sety(y)",
    "Set the turtle's second coordinate, leaving the first unchanged.",
  ],
  [
    "setheading",
    "setheading(angle)",
    "Set the turtle's orientation to angle. 0 is east in standard mode, north in logo mode.",
  ],
  ["seth", "seth(angle)", "Short form of setheading()."],
  [
    "home",
    "home()",
    "Move the turtle to the origin and set its heading back to 0.",
  ],
  [
    "circle",
    "circle(radius, extent=None, steps=None)",
    "Draw a circle or, with extent, an arc. A positive radius curves to the left.",
  ],
  [
    "dot",
    "dot(size=None, *color)",
    "Draw a filled dot at the current position.",
  ],
  ["position", "position()", "Return the turtle's current position as (x, y)."],
  ["pos", "pos()", "Short form of position()."],
  ["xcor", "xcor()", "Return the turtle's x coordinate."],
  ["ycor", "ycor()", "Return the turtle's y coordinate."],
  ["heading", "heading()", "Return the turtle's current heading."],
  [
    "towards",
    "towards(x, y=None)",
    "Return the angle from the turtle to the given position.",
  ],
  [
    "distance",
    "distance(x, y=None)",
    "Return the distance from the turtle to the given position.",
  ],
  [
    "degrees",
    "degrees(fullcircle=360)",
    "Measure angles in degrees, or in fullcircle units per revolution.",
  ],
  ["radians", "radians()", "Measure angles in radians."],
  [
    "speed",
    "speed(speed=None)",
    "Set the animation speed from 1 (slowest) to 10 (fastest), or 0 for no animation. Also accepts 'fastest', 'fast', 'normal', 'slow' and 'slowest'. Without an argument it returns the current speed.",
  ],
  ["undo", "undo()", "Undo the most recent turtle action."],
  [
    "undobufferentries",
    "undobufferentries()",
    "Return the number of actions that can still be undone.",
  ],
];

/** Pen control and colour. */
const TURTLE_PEN = [
  [
    "pendown",
    "pendown()",
    "Put the pen down — the turtle draws when it moves.",
  ],
  ["pd", "pd()", "Short form of pendown()."],
  ["down", "down()", "Short form of pendown()."],
  ["penup", "penup()", "Pull the pen up — the turtle moves without drawing."],
  ["pu", "pu()", "Short form of penup()."],
  ["up", "up()", "Short form of penup()."],
  [
    "pensize",
    "pensize(width=None)",
    "Set the line thickness. Without an argument it returns the current width.",
  ],
  ["width", "width(width=None)", "Same as pensize()."],
  [
    "pen",
    "pen(pen=None, **pendict)",
    "Read or set the pen's state as a dictionary (pendown, pencolor, fillcolor, pensize, speed, shown).",
  ],
  [
    "color",
    "color(*args)",
    "Set pen and fill colour at once: color(c), color(pen, fill) or color(r, g, b). Without arguments it returns both.",
  ],
  [
    "pencolor",
    "pencolor(*args)",
    "Set the line colour, as a name, an (r, g, b) tuple or three numbers. Without arguments it returns the current colour.",
  ],
  [
    "fillcolor",
    "fillcolor(*args)",
    "Set the fill colour, as a name, an (r, g, b) tuple or three numbers. Without arguments it returns the current colour.",
  ],
  [
    "begin_fill",
    "begin_fill()",
    "Start recording a shape to fill. Call end_fill() to fill it.",
  ],
  [
    "end_fill",
    "end_fill()",
    "Fill the shape drawn since the last begin_fill().",
  ],
  ["filling", "filling()", "Return True while a fill is being recorded."],
  [
    "write",
    "write(arg, move=False, align='left', font=('Arial', 8, 'normal'))",
    "Write text at the turtle's position.",
  ],
  [
    "setfontsize",
    "setfontsize(size)",
    "Set the default font size used by write().",
  ],
  [
    "clear",
    "clear()",
    "Erase this turtle's drawings, leaving its position and pen state alone.",
  ],
  [
    "reset",
    "reset()",
    "Erase this turtle's drawings and restore its starting state.",
  ],
];

/** The turtle cursor itself. */
const TURTLE_CURSOR = [
  ["showturtle", "showturtle()", "Make the turtle visible."],
  ["st", "st()", "Short form of showturtle()."],
  [
    "hideturtle",
    "hideturtle()",
    "Make the turtle invisible. Drawing is noticeably faster while hidden.",
  ],
  ["ht", "ht()", "Short form of hideturtle()."],
  ["isvisible", "isvisible()", "Return True if the turtle is visible."],
  [
    "shape",
    "shape(name=None)",
    "Set the turtle's shape: 'classic', 'arrow', 'turtle', 'circle', 'square', 'triangle' or 'blank'.",
  ],
  [
    "shapesize",
    "shapesize(stretch_wid=None, stretch_len=None, outline=None)",
    "Scale the turtle cursor and set its outline width.",
  ],
  [
    "turtlesize",
    "turtlesize(stretch_wid=None, stretch_len=None, outline=None)",
    "Same as shapesize().",
  ],
  [
    "tilt",
    "tilt(angle)",
    "Rotate the turtle's shape by angle, without changing its heading.",
  ],
  [
    "tiltangle",
    "tiltangle(angle=None)",
    "Read or set the shape's rotation relative to the heading.",
  ],
  [
    "settiltangle",
    "settiltangle(angle)",
    "Set the shape's rotation relative to the heading.",
  ],
  [
    "stamp",
    "stamp()",
    "Stamp a copy of the turtle's shape onto the canvas and return its id.",
  ],
  ["clearstamp", "clearstamp(stampid)", "Remove the stamp with the given id."],
  [
    "clearstamps",
    "clearstamps(n=None)",
    "Remove all stamps, the first n, or the last n if n is negative.",
  ],
];

/** Screen-level functions. */
const TURTLE_SCREEN = [
  [
    "Screen",
    "Screen()",
    "Return the screen object, which carries the window-level functions.",
  ],
  ["getscreen", "getscreen()", "Return the screen the turtle draws on."],
  [
    "Turtle",
    "Turtle()",
    "Create an additional turtle drawing on the same canvas.",
  ],
  ["bgcolor", "bgcolor(color)", "Set the background colour of the canvas."],
  [
    "bgpic",
    "bgpic(picname=None)",
    "Set a background image from a file in the IDE's file system.",
  ],
  [
    "screensize",
    "screensize(canvwidth=None, canvheight=None, bg=None)",
    "Set the size of the drawing canvas in pixels.",
  ],
  [
    "setup",
    "setup(width, height, startx=None, starty=None)",
    "Set the canvas size in pixels.",
  ],
  [
    "colormode",
    "colormode(cmode=None)",
    "Use colour values from 0 to 1 (cmode=1.0) or 0 to 255 (cmode=255).",
  ],
  [
    "mode",
    "mode(mode=None)",
    "Switch between 'standard' (0 = east) and 'logo' (0 = north). Changing the mode resets every turtle.",
  ],
  [
    "tracer",
    "tracer(n=None, delay=None)",
    "Draw only every n-th update. tracer(0) turns animation off until update() is called — the usual way to draw complex figures quickly.",
  ],
  ["update", "update()", "Redraw the canvas. Needed after tracer(0)."],
  [
    "delay",
    "delay(delay=None)",
    "Read or set the delay between drawing steps, in milliseconds.",
  ],
  ["title", "title(titlestring)", "Set the canvas title."],
  ["window_width", "window_width()", "Return the canvas width in pixels."],
  ["window_height", "window_height()", "Return the canvas height in pixels."],
  [
    "register_shape",
    "register_shape(name, shape)",
    "Register a polygon as a new turtle shape.",
  ],
  ["addshape", "addshape(name, shape)", "Same as register_shape()."],
  ["clearscreen", "clearscreen()", "Erase everything and reset every turtle."],
  ["resetscreen", "resetscreen()", "Reset every turtle to its starting state."],
  [
    "setundobuffer",
    "setundobuffer(size)",
    "Set how many actions undo() can step back through.",
  ],
  [
    "numinput",
    "numinput(title, prompt)",
    "Ask the user for a number and return it, or None if cancelled.",
  ],
  [
    "textinput",
    "textinput(title, prompt)",
    "Ask the user for a string and return it, or None if cancelled.",
  ],
  [
    "listen",
    "listen()",
    "Give the canvas keyboard focus, so key handlers fire.",
  ],
  [
    "onkey",
    "onkey(fun, key)",
    "Call fun when key is released. Requires listen().",
  ],
  [
    "onkeypress",
    "onkeypress(fun, key=None)",
    "Call fun when key is pressed. Requires listen().",
  ],
  ["onkeyrelease", "onkeyrelease(fun, key)", "Same as onkey()."],
  [
    "onclick",
    "onclick(fun, btn=1)",
    "Call fun(x, y) when the canvas is clicked.",
  ],
  ["onscreenclick", "onscreenclick(fun, btn=1)", "Same as onclick()."],
  ["ontimer", "ontimer(fun, t=0)", "Call fun after t milliseconds."],
  ["mainloop", "mainloop()", "No-op here — the canvas is always on screen."],
  ["done", "done()", "No-op here — the canvas is always on screen."],
  [
    "exitonclick",
    "exitonclick()",
    "No-op here — the canvas is always on screen.",
  ],
  ["bye", "bye()", "No-op here — the canvas is always on screen."],
];

const toOptions = (entries, boost = 0) =>
  entries.map(([label, detail, info]) => ({
    label,
    type: "function",
    detail,
    info,
    boost,
  }));

// Aliases and no-ops rank below the names we want learners to reach for first.
const isSecondary = ([, detail, info]) =>
  /^(Short form|Same as|No-op)/.test(info);

const buildOptions = (groups) => {
  const entries = groups.flat();
  return [
    ...toOptions(
      entries.filter((entry) => !isSecondary(entry)),
      1,
    ),
    ...toOptions(entries.filter(isSecondary), -1),
  ];
};

/** Everything reachable through `from turtle import *`. */
const MODULE_OPTIONS = buildOptions([
  TURTLE_MOVE,
  TURTLE_PEN,
  TURTLE_CURSOR,
  TURTLE_SCREEN,
]);

/** Everything reachable through an object: `turtle.`, a Turtle() or a Screen(). */
const MEMBER_OPTIONS = MODULE_OPTIONS.filter(
  (option) => option.label !== "Turtle" && option.label !== "Screen",
);

/**
 * Names that expose turtle members after a dot: the module itself plus any
 * variable assigned from Turtle(), Screen() or getscreen().
 */
const MEMBER_BASE_PATTERN =
  /(?:^|\n)\s*([A-Za-z_]\w*)\s*=\s*(?:turtle\s*\.\s*)?(?:Turtle|Screen|getscreen)\s*\(/g;

const memberBases = (doc) => {
  const bases = ["turtle"];
  for (const match of doc.matchAll(MEMBER_BASE_PATTERN)) {
    if (!bases.includes(match[1])) bases.push(match[1]);
  }
  return bases;
};

/**
 * Completion spec handed to HyperbookCM.create(). Only active once the script
 * actually imports turtle, so plain Python exercises are unaffected.
 * @type {import("../../../codemirror-bundle/index.js").CompletionSpec}
 */
export const turtleCompletions = {
  enabled: scriptLooksLikeTurtle,
  globals: MODULE_OPTIONS,
  members: MEMBER_OPTIONS,
  memberBases,
};
