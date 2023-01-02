---
name: Templates
---

# Templates

Sometimes you want a repeated layout in your Hyperbook. With templates, you can do that.
You can define a template by placing it in the `templates` folder at the root of your Hyperbook.
Then you can create `.yml` or `.json` files in your `book` folder.
The files need to have a property `template` which references a file from the `templates` folder.

## Example

The template is located at `templates/template-demo.md`:

```md
---
name: { { name } }
hide: true
---

# Description

{{ description }}

Templates are preprocessed, so you can use snippets aswell.

:Snippet{#smiley n=5}
```

In our book folder we can use the template by defining a YAML or JSON file:

```json
{
  "template": "template-demo",
  "name": "Templates - Demo",
  "description": "Hi I am a template demo\n for JSON"
}
```

[Resulting page for the JSON file](/advanced/template-demo-json)

```yaml
template: template-demo
name: Templates - Demo
description: |
  Hi I am a template demo
  for YAML.
```

[Resulting page for the YAML file](/advanced/template-demo-yaml)

## Helpers

You can use the same helpers as for [snippets](/elements/snippets#helpers)
