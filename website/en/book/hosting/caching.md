---
name: Caching
---

# Caching

Hyperbook's build cache stores downloaded runtimes on the machine running the
CLI. HTTP caches store the files readers request from your host or a CDN.

## Cache runtime downloads between builds

The CLI and VS Code share an asset cache. Builds reuse downloaded runtimes
instead of fetching them again. You can set `HYPERBOOK_ASSET_CACHE` to choose
its directory; the default is:

| System | Directory |
| --- | --- |
| Linux | `$XDG_CACHE_HOME/hyperbook/assets`, or `~/.cache/hyperbook/assets` |
| macOS | `~/Library/Caches/hyperbook/assets` |
| Windows | `%LOCALAPPDATA%\hyperbook\assets` |

CI runners usually start with an empty filesystem. Restore the asset cache
before building and save it afterwards. For example, add these steps after
checkout and Node.js setup in your GitHub Pages workflow:

```yaml
- name: Cache Hyperbook runtimes
  uses: actions/cache@v4
  with:
    path: .cache/hyperbook-assets
    key: ${{ runner.os }}-hyperbook-assets-${{ hashFiles('package-lock.json', 'pnpm-lock.yaml', 'hyperbook.json') }}-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-hyperbook-assets-

- name: Build
  env:
    HYPERBOOK_ASSET_CACHE: .cache/hyperbook-assets
  run: npx hyperbook build
```

The cache key saves newly needed runtimes when the book changes, and
`restore-keys` allows later builds to reuse earlier downloads. Hyperbook checks
cached files against its runtime manifest and downloads missing or changed
bundles. Keep the normal online build so a cache miss can recover. See
[GitHub's caching documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching).

On GitLab, cache `.cache/hyperbook-assets` and set the same
`HYPERBOOK_ASSET_CACHE` variable in your Pages job. Do not publish this directory;
publish only `.hyperbook/out`.

CDN-enabled elements need no local runtime download. PyIDE uses a CDN by
default. For an offline book, set `elements.pyide.cdn` to `false`, run
`npx hyperbook assets fetch` while online, and then build with
`npx hyperbook build --offline`. The `--offline` flag controls the build's
downloads; it does not make a book with CDN URLs usable offline.

## Cache files for readers

If your host lets you configure response headers, use the following policies
as a starting point for public books:

| Files | `Cache-Control` | Effect |
| --- | --- | --- |
| HTML and files replaced at the same URL | `no-cache` | Check for updates before reusing the cached response. |
| Files with a content hash or immutable release version in their URL | `public, max-age=31536000, immutable` | Reuse the file for a year; publish changes at a new URL. |

Enable `ETag` or `Last-Modified` on your server so unchanged files can be
revalidated without downloading their contents. For files at stable URLs, a
short lifetime such as `public, max-age=3600` is also possible if a delay of up
to one hour after updates is acceptable. These settings follow the
[HTTP caching standard](https://httpwg.org/specs/rfc9111.html#field.cache-control).

Hyperbook's locally exported runtimes use stable paths under
`__hyperbook_assets/directive-*/`. Do not give that entire directory an
immutable lifetime: upgrading Hyperbook can replace files at the same URL.
Apply the same rule to files copied from your `public` directory. Set headers
on your hosting service or web server; adding them to `hyperbook.json` does not
configure HTTP caching.

Openpatch's versioned runtime releases on `cdn.openpatch.org` already send
`Cache-Control: public, max-age=31536000, immutable`. Pyodide's versioned
jsDelivr distribution is also cached by browsers; see the
[Pyodide deployment documentation](https://pyodide.org/en/stable/usage/downloading-and-deploying.html).
Your book's hosting settings do not change headers sent by these CDNs.
