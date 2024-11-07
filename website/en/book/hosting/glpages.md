---
name: GitLab Pages
---

# Deploy on GitLab Pages

:::alert{warn}
Remember to add a basePath to your [configuration](/configuration/book), when deploying to GitLab pages.
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

Example Repository: https://gitlab.com/mikebarkmin/hyperbook-gitlab-pages
