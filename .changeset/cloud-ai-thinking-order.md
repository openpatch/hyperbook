---
"@hyperbook/cloud": patch
---

The AI assistant shows an answer in the order it happened: each stretch of the model's thinking gets its own folding block between the files it read and the text it wrote, instead of one thinking block at the top that kept filling up while the model worked. The order is kept with the conversation, so it looks the same after a reload. The history and new-chat buttons show their pointer and tooltip again (they are no longer disabled — switching chats stops a running answer), and the thinking-effort picker no longer touches the input field. Needs a database migration (applied on start).
