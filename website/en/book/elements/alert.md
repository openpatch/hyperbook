---
name: Alert
permaid: alert
---

# Alert

Alerts are a great way to get the attention of a reader.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `error` / `success` / `info` / `warn` | Positional alert type, for example `:::alert{warn}` | neutral alert |
| `color` | Custom color for the alert | - |
| `label` | Custom label or emoji shown as the alert icon | - |

```md
:::alert
Default
:::

:::alert{error}
Error
:::

:::alert{success}
Success
:::

:::alert{info}
Info
:::

:::alert{warn}
Warn
:::
```

:::alert
Default
:::

:::alert{error}
Error
:::

:::alert{success}
Success
:::

:::alert{info}
Info
:::

:::alert{warn}
Warn
:::

## Custom Alert
Alerts with custom colors and labels can also be used.
```md
:::alert{color="#FF00FF" label="💡"}
My custom note
:::
```
:::alert{color="#FF00FF" label="💡"}
My custom note
:::

:::alert{info}
It is good practice to place your custom alerts in a [snippet](/@/snippets).
:::
