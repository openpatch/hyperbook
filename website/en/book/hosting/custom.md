---
name: Custom
---

# Deploy on Your Server

You just need to copy the output folder after running build command.

```
npx hyperbook build

cp -R .hyperbook/out /var/www/my-website
```

:::alert{warn}
If you deploy to a subfolder ensure to set the basePath option in your [Hyperbook configuration](/configuration/book).
:::
