---
"hyperbook": minor
---

Add auto archives to supply for example code templates or other files which you
want to distribute in bulk in a folder. (Single files can still be put into the
public folder)

You can put folders inside a `archives` folder in the root of your hyperbook.
These folders will be zipped and put into the `public` folder. You can easily
provide the zipped folders by using the `archive` directive.

```
:archive[Download me!]{name="project-1"}
```
