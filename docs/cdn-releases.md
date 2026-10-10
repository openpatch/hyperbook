# Runtime releases on cdn.openpatch.org

Cloudflare R2 bucket `cdn` serves immutable runtime releases through the custom
domain `cdn.openpatch.org`. Each repository owns its release uploads:

| Repository             | Object prefix                      | Trigger                                                       |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `openpatch/online-ide` | `onlineide/<release-tag>/include/` | Published GitHub release, after attaching `dist-embedded.zip` |
| `openpatch/sql-ide`    | `sqlide/<release-tag>/include/`    | Published GitHub release, after attaching `dist-embedded.zip` |
| `openpatch/hyperbook`  | `openscad/<cdnVersion>/`           | Hyperbook release workflow, before publishing packages        |

All workflows use Wrangler and the Cloudflare API token in the organization
Actions secret `CLOUDFLARE_R2_CDN`. Set `CLOUDFLARE_ACCOUNT_ID` as an organization
Actions variable or secret. Grant both to the publishing repositories. S3 access
keys are unnecessary. The token needs remote R2 object read/write and bucket
CORS configuration permissions for `cdn`.

The IDE publishers download the ZIP already attached to the release and verify
GitHub's SHA-256 digest. HTML examples and source maps are excluded. OpenSCAD is
prepared directly from the upstream WASM distribution and the pinned font and
library downloads in `packages/markdown/runtime-assets.json`, with SHA-256
verification. It does not read a published Markdown package.

Every object gets its correct MIME type and
`Cache-Control: public, max-age=31536000, immutable`. The publisher retains old
versions, refuses conflicting files, resumes interrupted uploads and writes
`manifest.json` last. Every upload is followed by a public-domain check of all
file checksums, MIME types, cache headers and CORS. A same-version rerun is safe.
Repository concurrency groups prevent overlapping uploads of the same release;
keep each prefix owned by its repository.

The workflows apply `scripts/cdn-cors.json` to allow public GET/HEAD requests
from any origin. This is needed for JavaScript modules, workers, WASM and fonts,
including VS Code webview previews. There is no public upload permission.

## First upload and retries

In each IDE repository, open **Actions → Release Embedded Build → Run workflow**
and enter an existing published tag in `cdn_release_tag`. Leaving that input
empty retains the existing manual build/artifact behavior. The equivalent CLI
commands are:

```sh
gh workflow run release-embedded.yml --repo openpatch/online-ide -f cdn_release_tag=v2.2.1-hyperbook.28
gh workflow run release-embedded.yml --repo openpatch/sql-ide -f cdn_release_tag=v2.0.0-hyperbook.4
gh workflow run publish-openscad-cdn.yml --repo openpatch/hyperbook
```

Once the CDN uploads pass verification, Hyperbook can pin these base URLs:

```json
{
  "elements": {
    "onlineide": {
      "cdn": "https://cdn.openpatch.org/onlineide/v2.2.1-hyperbook.28/"
    },
    "sqlide": { "cdn": "https://cdn.openpatch.org/sqlide/v2.0.0-hyperbook.4/" },
    "openscad": { "cdn": "https://cdn.openpatch.org/openscad/2026.10.08-1/" }
  }
}
```

Keep `include/` below the IDE base URLs. Relative chunks, workers and other
assets resolve there automatically. Pin a release version; changing a moving
`latest` alias could break older books.

## Updating OpenSCAD

Update the upstream URL and SHA-256 in `openscad-config.json`, then increment
`wasmBuild.cdnVersion`. Increment it when changing font or library downloads as
well. Publish that version before using it as Hyperbook's default. The build
continues to keep the small Hyperbook integration scripts local.

## Cloudflare caching

Let the custom domain respect object Cache-Control headers. Do not cache 404
responses: a version should not remain missing after its first upload. If the
hostname already served cached responses before the CORS policy was applied,
purge those URLs or the hostname once, following the
[Cloudflare CORS guidance](https://developers.cloudflare.com/r2/buckets/cors/#use-cors-with-a-custom-domain).
