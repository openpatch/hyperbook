---
name: Javaide
permaid: javaide
---

# JavaIDE

JavaIDE loads [CheerpJ](https://cheerpj.com/) 5 from its versioned CDN by default. CheerpJ is a full OpenJDK compiled to WebAssembly: the reader's browser downloads the runtime, compiles their Java with the JDK's own `javac` and runs it — all client-side, no server. The runtime is large, so Hyperbook keeps it out of the exported book; readers need an internet connection, and their browsers cache the runtime for later visits.

To serve the runtime yourself (self-hosted or offline books), mirror CheerpJ 5.0 (the directory containing `loader.js`, e.g. from `https://cjrtnc.leaningtech.com/5.0/`) and point `elements.javaide.cdn` at it in `hyperbook.json`:

```json
{
  "elements": {
    "javaide": { "cdn": "https://example.com/cheerpj/5.0/" }
  }
}
```

CheerpJ is free for non-commercial open-source projects and educational use with a "Built with CheerpJ" credit; see [CheerpJ's licensing](https://cheerpj.com/licensing/).

The `javaide` element represents a Java Integrated Development Environment (IDE) component. Readers can edit, compile and run Java programs directly in the browser.

## Basic example

::::javaide

```java
public class Main {
  public static void main(String[] args) {
    System.out.println("Hello World");
  }
}
```

::::

## Multiple files

Add one code block per file, naming the file in the fence. The block without `file="…"` is the main file (default `Main.java`). A public class must live in the file of the same name.

::::javaide

```java
System.out.println(Helper.greet());
```

```java file="Helper.java"
class Helper {
  static String greet() {
    return "Hello from Helper!";
  }
}
```

::::

Use `main="App.java"` to run a different file than `Main.java`.

## Data files

Hand a file of the book to the program with `::file`; the program reads it from its own flat file system under its file name.

::::javaide

```java
import java.nio.file.*;

public class Main {
  public static void main(String[] args) throws Exception {
    for (String line : Files.readAllLines(Paths.get("data.txt"))) {
      System.out.println(line);
    }
  }
}
```

::file{path="data.txt" src="/data.txt"}

::::

## Tests

A code block with `role="test" hidden` is a test. The **Test** button compiles all files and runs every test class, then shows a report: how many tests passed and each test with its status and what it printed. A test fails when it exits with an error — for example an uncaught `AssertionError`.

::::javaide

```java
public class Main {
  public static void main(String[] args) {
    System.out.println(Helper.greet());
  }
}
```

```java file="Helper.java"
class Helper {
  static String greet() {
    return "Hello";
  }
}
```

```java file="TestHelper.java" role="test" hidden
public class TestHelper {
  public static void main(String[] args) {
    if (!Helper.greet().equals("Hello")) {
      throw new AssertionError("greet() should return Hello");
    }
  }
}
```

::::

## Attributes

| Attribute | Description | Default |
|-----------|-------------|---------|
| `main` | The file that runs | `Main.java` |
| `files` | Which file actions readers get (`create,upload,rename,delete`, `open`, `none`) | none |
| `accept` | File types for upload | `.java` |
| `height` | Height of the IDE, e.g. `height=500` | `calc(100dvh - 80px)` |
| `id` | A stable id for the element | generated |

## Limitations

- Console programs only: CheerpJ does not support `System.in` / console input yet.
- Source files live in a flat namespace: do not use `package` declarations.
- The Stop button ends the running program by terminating its worker, so no page reload is needed.
