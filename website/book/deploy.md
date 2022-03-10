---
name: Deploy
index: 3
---

## Deploy on Vercel

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

## Deploy on GitHub Pages

?> Remember to add a basePath to your [configuration](/configuration), when deploying to GitHub pages.

For GitHub Pages you can use the following action:

```yaml
name: GitHub Pages

on:
  push:
    branches:
      - main # Set a branch name to trigger deployment
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-20.04
    concurrency:
      group: ${{ github.workflow }}-${{ github.ref }}
    steps:
      - uses: actions/checkout@v2

      - name: Setup and Build
        run: |
          npx hyperbook setup
          npx hyperbook build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        if: ${{ github.ref == 'refs/heads/main' }}
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./.hyperbook/out
```

## Deploy on Your Server

You just need to copy the output folder after running the setup and build command.

```
npx hyperbook setup
npx hyperbook build

cp -R .hyperbook/out /var/www/my-website
```
