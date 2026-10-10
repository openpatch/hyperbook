---
name: Caching
lang: de
---

# Caching

Der Build-Cache von Hyperbook speichert heruntergeladene Laufzeitumgebungen auf
dem Rechner der CLI. HTTP-Caches speichern Dateien, die Leser von deinem Host
oder einem CDN abrufen.

## Downloads zwischen Builds aufbewahren

CLI und VS Code teilen sich einen Asset-Cache. Builds verwenden bereits
heruntergeladene Laufzeitumgebungen erneut. Mit `HYPERBOOK_ASSET_CACHE` kannst
du das Verzeichnis festlegen. Standardmäßig wird dieser Pfad verwendet:

| System | Verzeichnis |
| --- | --- |
| Linux | `$XDG_CACHE_HOME/hyperbook/assets` oder `~/.cache/hyperbook/assets` |
| macOS | `~/Library/Caches/hyperbook/assets` |
| Windows | `%LOCALAPPDATA%\hyperbook\assets` |

CI-Runner starten normalerweise mit einem leeren Dateisystem. Stelle den
Asset-Cache vor dem Build wieder her und speichere ihn danach. Füge zum
Beispiel diese Schritte nach Checkout und Node.js-Einrichtung in deinen
GitHub-Pages-Workflow ein:

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

Der Cache-Schlüssel speichert neu benötigte Laufzeitumgebungen, wenn sich das
Buch ändert. Mit `restore-keys` verwenden spätere Builds frühere Downloads
erneut. Hyperbook prüft die Dateien anhand seines Laufzeitmanifests und lädt
fehlende oder geänderte Pakete herunter. Verwende den normalen Online-Build,
damit ein fehlender Cache automatisch ergänzt wird. Siehe die
[GitHub-Dokumentation zum Caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching).

Bei GitLab kannst du `.cache/hyperbook-assets` zwischenspeichern und dieselbe
Variable `HYPERBOOK_ASSET_CACHE` im Pages-Job setzen. Veröffentliche dieses
Verzeichnis nicht, sondern nur `.hyperbook/out`.

Elemente mit aktiviertem CDN benötigen keinen lokalen Download. PyIDE verwendet
standardmäßig ein CDN. Setze für ein Offline-Buch `elements.pyide.cdn` auf
`false`, führe mit Internetverbindung `npx hyperbook assets fetch` aus und baue
anschließend mit `npx hyperbook build --offline`. `--offline` steuert die
Downloads beim Build. Ein Buch mit CDN-URLs wird dadurch nicht offline nutzbar.

## Dateien im Browser zwischenspeichern

Wenn dein Host eigene Antwort-Header erlaubt, kannst du für öffentliche Bücher
mit diesen Einstellungen beginnen:

| Dateien | `Cache-Control` | Wirkung |
| --- | --- | --- |
| HTML und Dateien, die unter derselben URL ersetzt werden | `no-cache` | Vor der Wiederverwendung auf Aktualisierungen prüfen. |
| Dateien mit Inhalts-Hash oder unveränderlicher Release-Version in der URL | `public, max-age=31536000, immutable` | Ein Jahr wiederverwenden; Änderungen unter einer neuen URL veröffentlichen. |

Aktiviere auf deinem Server `ETag` oder `Last-Modified`, damit unveränderte
Dateien ohne erneuten Download ihrer Inhalte geprüft werden können. Für stabile
URLs ist auch eine kurze Dauer wie `public, max-age=3600` möglich, wenn bis zu
eine Stunde Verzögerung nach Änderungen akzeptabel ist. Diese Einstellungen
folgen dem [HTTP-Caching-Standard](https://httpwg.org/specs/rfc9111.html#field.cache-control).

Die lokal exportierten Laufzeitumgebungen verwenden stabile Pfade unter
`__hyperbook_assets/directive-*/`. Gib nicht dem gesamten Verzeichnis eine
unveränderliche Cache-Dauer: Ein Hyperbook-Update kann Dateien unter derselben
URL ersetzen. Das gilt auch für Dateien aus deinem `public`-Verzeichnis. Setze
die Header beim Hosting-Dienst oder Webserver. Ein Eintrag in `hyperbook.json`
konfiguriert kein HTTP-Caching.

Die versionierten Laufzeit-Releases auf `cdn.openpatch.org` senden bereits
`Cache-Control: public, max-age=31536000, immutable`. Auch die versionierte
Pyodide-Distribution auf jsDelivr wird im Browser zwischengespeichert; siehe die
[Pyodide-Dokumentation](https://pyodide.org/en/stable/usage/downloading-and-deploying.html).
Die Hosting-Einstellungen deines Buchs ändern die Header dieser CDNs nicht.
