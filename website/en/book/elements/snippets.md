---
name: Snippets
---

# Snippets

Sometimes you want to repeat a certain element, or you want to create
your own element. Snippets allow you to do exactly that.

:::alert{warn}
Snippet files need to be placed in the `snippets` folder at the root of
your hyperbook beside the glossary and book folders.
:::

## Examples

### Example 1: Block

Here is a simple example of a snippet for using a protect element with
the same password and id across your hyperbook.

The snippet located in `snippets/password.md.hbs`:

```md
:::protect{id="1" password="hyperbook" description="The password is the name of this project."}

{{{ content }}}

:::

{{#if hint}}

:::alert{info}

Hyperbook is the password.

:::

{{/if}}
```

The markdown you need to place in your hyperbook:

```md
:::Snippet{#password}

:smiley:

:::
```

The result:

:::snippet{#password}

:smiley:

:::

### Example 2: Block with Parameter

You can also pass parameters to your snippet to make them dynamic. For
example our password snippet from above allows to pass a hint
parameter. If the hint parameter is true, a alert element will be shown.

```md
:::Snippet{#password hint=true}

::qr{value="https://hyperbook.openpatch.org" size="XL"}

:::
```

:::snippet{#password hint=true}

::qr{value="https://hyperbook.openpatch.org" size="XL"}

:::

### Example 3: Inline

```hbs
{{#times n}}
  :smiley:
{{/times}}
```

```md
:Snippet{#smiley n=10}
```

We are ten smilies: :snippet{#smiley n=10}

## Parameters

You can use the parameters by using curly brackets and the name of the
parameter.

```hbs
{{{p1}}}
```

Three curly brackets will give you the raw content.

Two curly brackets will give the HTML-escaped content.

### Content

If your snippet spans across multiple lines, you can use the content
parameter to use those. See Example 1.

:::alert{warn}
You need to use three curly brackets for the content parameter.
:::

## Helpers

You can use the following helpers in your snippets

### if

You can use the if helper to conditionally render a block.

```hbs
{{#if p}}
  content
{{/if}}
```

### unless

You can use the unless helper as the inverse of the if helper. Its block will be rendered if the expression returns a falsy value.

```hbs
{{#unless hint}}
  content
{{/unless}}
```

### times

You can use the times helper to repeat block.

```hbs
{{#times 10}}
  Hi
{{/times}}
```

### file

You can use the file helper to include the content of a file.

```hbs
{{{file "/archives/project-1/main.c"}}}
```

You can also only use a few lines of the file.

```hbs
{{{file "/archives/project-1/main.c" "1,3-4"}}}
```

And you can define an ellipsis.

```hbs
{{{file "/archives/project-1/main.c" "1,3-4" "// ..."}}}
```

### base64

You can use the bae64 helper to embedded media, even from external folders.

```hbs
{{base64 "path/relative/to/root/folder"}}
```

This works best in conjunction with the image block:

```hbs
![]({{base64 "path/relative/to/root/folder"}})
```

### concat

```hbs
{{concat "Hi" " there"}}
```

Hi there

### camelcase

```hbs
{{camcelcase "This is a test"}}
```

thisIsATest

### pascalcase

```hbs
{{pascalcase "This is a test"}}
```

ThisIsATest

### dashcase

```hbs
{{dashcase "This is a test"}}
```

This-is-a-test

### lowercase

```hbs
{{lowercase "This is a test"}}
```

this is a test

### uppercase

```hbs
{{lowercase "This is a test"}}
```

THIS IS A TEST

### replace

```hbs
{{replace "Give me Banana Banana" "Banana" "Apple"}}
```

Give me Apple Banana

### replaceAll

```hbs
{{replaceAll "Give me Banana Banana" "Banana" "Apple"}}
```

Give me Apple Apple
