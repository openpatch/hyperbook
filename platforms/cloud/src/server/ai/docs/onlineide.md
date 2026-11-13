# onlineide (Java IDE)

`:::onlineide` lets readers edit and run Java in the browser. One fenced block
per file, named in the fence. The file whose name matches the public class must
carry that name: a `public class Equals` lives in `Main.java` only if the class
is `Main` — name the file after the class (`Equals.java`), or the build fails.

    :::onlineide

    ```java Main.java
    System.out.println("Hello");
    ```

    :::

Attributes: `fileList` (show the file list, default `true`), plus the usual `id`,
`files`, `accept` (default `.java`).

Files beyond the code blocks: `::file{path="…" src="…"}` adds a file from the
book. A trailing flag works on a fence (```java Beispiel.java hidden`) and on
a `::file` (`::file{path="BeispielTest.java" src="…" hidden}`). `hidden` keeps
the file out of the file list — readers cannot open, edit or delete it, while
it still compiles, so tests against a solution keep running; `readonly` shows
the file but opens it for reading only.
