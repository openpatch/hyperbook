---
"@hyperbook/markdown": patch
---

Relative paths work in every directive's file attributes, resolved from the page's folder like links: `::kirimoto{model}`, `::embed{src}`, tile icons and learning map videos now resolve them too. Files a directive inlines (`::learningmap`, `::bitflow`, `::jmp`, the IDEs' `::file`) read `./` and `../` from the page's folder, and never from outside the book.
