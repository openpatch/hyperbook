---
name: Custom
---

# Deploy on Your Server

See [Caching](/hosting/caching#cache-files-for-readers) for recommended HTTP
headers when configuring your server.

You just need to copy the output folder after running build command.

```
npx hyperbook build

cp -R .hyperbook/out /var/www/my-website
```

:::alert{warn}
If you deploy to a subfolder ensure to set the basePath option in your [Hyperbook configuration](/configuration/book).
:::
