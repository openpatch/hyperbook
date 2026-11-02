# javaide (Java IDE)

`:::javaide` lets readers edit and run Java in the browser. CheerpJ 5 (a full
OpenJDK in WebAssembly) compiles the code with `javac` and runs it client-side,
so no server is needed. One `java` fenced block per file, named in the fence;
the `main` attribute says which file runs (default `Main.java`). A public class
must live in the file of the same name (`Main.java`).

    :::javaide

    ```java Main.java
    public class Main {
      public static void main(String[] args) {
        System.out.println("Hello");
      }
    }
    ```

    :::

Attributes: `main`, `id`, `files`, `accept` (default `.java`), `height`.
External files: `::file{path="data.csv" src="…"}` inside the directive.

## Tests

A file with `role="test" hidden` is a test: the **Test** button compiles
everything and runs every test class, then shows a report. A test fails when it
exits non-zero (e.g. an uncaught `AssertionError`).

    :::javaide

    ```java Main.java
    System.out.println(Helper.greet());
    ```

    ```java Helper.java
    class Helper { static String greet() { return "hi"; } }
    ```

    ```java file="TestHelper.java" role="test" hidden
    public class TestHelper {
      public static void main(String[] args) {
        if (!Helper.greet().equals("hi")) throw new AssertionError();
      }
    }
    ```

    :::

Notes: the CheerpJ runtime loads from Leaning Technologies' CDN
(`elements.javaide.cdn` can point at a self-hosted mirror). Console programs
only in this element — `System.in` is not supported by CheerpJ. Source files
live in a flat namespace: no `package` declarations yet.
