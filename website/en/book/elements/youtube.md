---
name: YouTube
permaid: youtube
next:
---

# YouTube

:::alert{warn}
**Requires a network connection.** Videos are streamed from `youtube-nocookie.com` and cannot be bundled with the hyperbook build output. This element will not work in offline or network-restricted environments.
:::

The YouTube directive uses the special `#id` syntax to pass the video id. The text inside `[]` is used as the iframe title.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `#<video-id>` | YouTube video id, for example `#LXb3EKWsInQ` | - |

```md
::youtube[Costa Rica]{#LXb3EKWsInQ}
```

::youtube[Costa Rica]{#LXb3EKWsInQ}
