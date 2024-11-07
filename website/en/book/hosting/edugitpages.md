---
name: EduGit Pages
---

# Deploy on EduGit Pages

## Prepare your Repository

You need to enable CI/CD for your repository. Go to Settings/General and toggle CI/CD on.

EduGit Page does also only work on branches which allow Developers to push, since the pipeline user has only developer rights. Go to Settings/Repository/Protected branches and allow at least developers to push to your main branch. You can also just unprotect the main branch.

## CI/CD Pipeline Config

:::alert{warn}
Remember to add a basePath to your [configuration](/configuration/book), when deploying to EduGit pages.
:::

```yml
image: node:latest

pages:
  stage: deploy
  script:
    - npx hyperbook build
    - mkdir .public
    - cp -r ./.hyperbook/out/* .public
    - rm -rf public
    - mv .public public
  artifacts:
    paths:
      - public
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

Example Repository: https://edugit.org/mikebarkmin/hyperbook-edugit-pages
