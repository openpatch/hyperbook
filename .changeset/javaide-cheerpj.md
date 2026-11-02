---
"@hyperbook/types": minor
"@hyperbook/markdown": minor
"hyperbook": minor
"hyperbook-studio": minor
"@hyperbook/cloud": minor
---

New `:::javaide` element: a Java IDE in the browser powered by CheerpJ 5. CheerpJ 5 ships the full JDK, so the reader's browser compiles their `.java` files with `javac` and runs them client-side — no server. The element supports multi-file workspaces, `::file` data files, a Test button that runs every `role="test"` file and reports pass/fail, and a Stop button that terminates the worker the JVM runs on. CheerpJ loads from its versioned CDN (`https://cjrtnc.leaningtech.com/5.0/`) by default, like PyIDE loads Pyodide; `elements.javaide.cdn` can point at a self-hosted CheerpJ 5.0 mirror. Limitations: console programs only (CheerpJ has no `System.in` yet) and a flat file namespace (no `package` declarations).
