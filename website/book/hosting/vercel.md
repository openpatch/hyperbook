---
name: Vercel
---

# Deploy on Vercel

First you need to create a `vercel.json` file at the root of your
project with the following content.

```json
{
  "cleanUrls": true
}
```

Then you can create a new project on Vercel.

Use `Other` as your framework preset.

For the `build command` you should use:

```
npx hyperbook build
```

For the `output directory` you should use:

```
.hyperbook/out
```

For the `install command` you should use:

```
npx hyperbook setup
```

Now you have everything setup. Enjoy your Hyperbook!
