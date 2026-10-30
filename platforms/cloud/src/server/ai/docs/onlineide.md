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
