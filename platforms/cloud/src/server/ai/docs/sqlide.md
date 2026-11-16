# sqlide (SQL IDE)

`:::sqlide` lets readers run SQL in the browser. One fenced block, named in the
fence (convention: `mysql Statements.sql`).

    :::sqlide

    ```mysql Statements.sql
    SELECT * FROM students;
    ```

    :::

`dock` (flag, or `dock="Label"`): readers can move the element into the dock
beside the text, to keep it in view while working through the tasks after it.
See the `dock` topic.
