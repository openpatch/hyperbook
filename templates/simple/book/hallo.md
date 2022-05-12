---
name: Hallo Test
hide: false
index: 1
---

:::mermaid
classDiagram
Animal <|-- Duck
Animal <|-- Fish
Animal <|-- Zebra
Animal : +int age
Animal : +String gender
Animal: +isMammal()
Animal: +mate()
class Duck{
+String beakColor
+swim()
+quack()
}
class Fish{
-int sizeInFeet
-canEat()
}
class Zebra{
+bool is_wild
+run()
}
:::

Das ist ein Test :t[dog]

::::tabs{id="code"}

:::tab{title="Hi" id="python"}
Here is a tab

Another Test
:::

:::tab{title="Huh a super long tab which might cause overflöw"}
Another tab with a [link](#)

Other

:::

:::tab{title="Third"}

Wow

:::

::::

::::tabs{id="code"}

:::tab{title="Hi" id="python"}
Here is a tab

Another Test
:::

:::tab{title="Huh a super long tab which might cause overflöw"}
Another tab with a [link](#)

Other

:::

:::tab{title="Third"}

Wow

:::

::::

## Collapsible

::::collapsible{title="Hallo" id=1}

This is a panel

:::collapsible{title="Nested" id=1}

This is a stacked collapsible connected with the parent collapsible

:::

Das ist ein Test

:::collapsible{title="With an Image"}

::task{src="/task.json"}
![](/test.jpg)

::::

## Bitflow

### Flow

::flow{src="/flow.json"}

### Task

::task{src="/task.json"}
