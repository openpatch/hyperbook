---
name: Cloud [Alpha]
index: 3
lang: de
---

# Cloud [Alpha] 

:::alert{warn}

Diese Funktion befindet sich noch in der Alpha-Phase. Sie ist möglicherweise fehlerhaft und unterliegt Änderungen. Bitte teste sie und teile dein Feedback mit uns!

:::

Hyperbook Cloud ist eine selbst gehostete Plattform zur Schülerverwaltung, die Benutzeranmeldung, Fortschrittsverfolgung und Cloud-Synchronisierung für deine Hyperbooks ermöglicht.

## Einrichtung

Um ein Hyperbook mit einem Cloud-Server zu verbinden, füge die `cloud`-Eigenschaft zu deiner `hyperbook.json` hinzu:

```json
{
  "name": "Mein Hyperbook",
  "cloud": {
    "url": "https://cloud.example.com",
    "id": "mein-hyperbook"
  }
}
```

| Eigenschaft | Beschreibung |
|---|---|
| `url` | Die URL deines Hyperbook-Cloud-Servers. |
| `id` | Der Slug des Hyperbooks, wie er in der Cloud-Admin-Oberfläche konfiguriert ist. Muss exakt übereinstimmen. |

## Funktionsweise

Wenn Cloud konfiguriert ist, erscheint ein Login-Button im Hyperbook. Schüler melden sich mit den Zugangsdaten an, die ihre Lehrkraft in der Cloud-Admin-Oberfläche erstellt hat.

Nach der Anmeldung passiert automatisch Folgendes:

- **Zustandssynchronisierung** — Alle Zustände interaktiver Elemente (Code-Editoren, Lesezeichen, Aufklappelemente, Excalidraw-Zeichnungen usw.) werden auf dem Cloud-Server gespeichert.
- **Geräteübergreifender Zugriff** — Schüler können auf jedem Gerät dort weitermachen, wo sie aufgehört haben.
- **Offline-Unterstützung** — Änderungen werden lokal zwischengespeichert, wenn keine Verbindung besteht, und synchronisiert, sobald die Verbindung wiederhergestellt ist.
- **Auto-Save-Anzeige** — Ein Status-Icon zeigt den aktuellen Synchronisierungsstatus an (gespeichert, speichernd, ungespeichert, offline).

Wenn man in die Cloud eingeloggt ist, werden die lokalen Export-, Import- und Zurücksetzen-Buttons ausgeblendet, um Konflikte mit dem Cloud-verwalteten Zustand zu vermeiden.

## Event-Sourcing-Architektur

Anstatt bei jeder Änderung den gesamten Speicher zu senden, verwendet Hyperbook Cloud einen Event-Sourcing-Ansatz für eine effiziente Synchronisierung.

### Funktionsweise

1. **Granulare Event-Erfassung** — Jede Änderung an der lokalen Dexie-Datenbank (Erstellen, Aktualisieren, Löschen) wird als einzelnes Event über Dexie-Hooks erfasst. Bei Aktualisierungen werden nur die geänderten Felder (Deltas) aufgezeichnet, nicht die gesamte Zeile.
2. **Gebündelte Synchronisierung** — Events werden gesammelt und nach einer Verzögerungszeit (2 Sekunden Inaktivität oder maximal 10 Sekunden Wartezeit) gebündelt an den Cloud-Server gesendet.
3. **Serverseitige Snapshots** — Der Server komprimiert regelmäßig Events zu Snapshots. Nach 100 Events (konfigurierbar über die Umgebungsvariable `SNAPSHOT_THRESHOLD`) wird ein neuer Snapshot erstellt und alte Events werden bereinigt.
4. **Zustandsrekonstruktion** — Wenn ein Schüler seinen Zustand lädt, rekonstruiert der Server diesen, indem alle Events seit dem letzten Snapshot angewendet werden.

### Umgang mit großen Daten

Wenn ein Event-Batch 512 KB überschreitet (z. B. große Excalidraw-Zeichnungen oder Geogebra-Zustände), sendet der Client stattdessen einen vollständigen Snapshot anstelle einzelner Events. Dies verhindert Bandbreitenprobleme bei großen Binärdaten.

### Konflikterkennung

Der Client verfolgt die letzte bekannte Event-ID vom Server. Beim Senden von Events wird diese ID als `afterEventId` mitgesendet. Wenn der Server erkennt, dass der Client veraltet ist (z. B. weil ein anderes Gerät zwischenzeitlich Events gesendet hat), antwortet er mit einem 409-Konflikt und der Client ruft den neuesten Zustand erneut ab.

### Offline-Warteschlange

Wenn das Gerät offline ist, werden Events in einer lokalen Warteschlange mit ihrer `afterEventId` gespeichert. Sobald die Verbindung wiederhergestellt ist, wird die Warteschlange der Reihe nach abgearbeitet. Wird während der Wiedergabe ein Konflikt erkannt, verwirft der Client die Warteschlange und ruft den Zustand erneut vom Server ab.

## Cloud-Server

Der Cloud-Server ist eine separate Anwendung im Verzeichnis `platforms/cloud/` des Hyperbook-Repositories. Siehe die [Cloud-README](https://github.com/openpatch/hyperbook/tree/main/platforms/cloud) für Installations- und Deployment-Anleitungen.

### Wichtige Konzepte

- **Hyperbooks** — Jedes Hyperbook wird in der Cloud mit einem eindeutigen Slug registriert. Dieser Slug wird als `cloud.id` verwendet.
- **Gruppen** — Schüler werden innerhalb eines Hyperbooks in Gruppen organisiert.
- **Schüler** — Jeder Schüler hat einen Benutzernamen und ein Passwort für die Anmeldung im Hyperbook.
- **Lehrkräfte** — Lehrkräfte können Gruppen und Schüler für ihre zugewiesenen Hyperbooks verwalten.
- **Berechtigungen** — Admins können Lehrkräften feingranulare Berechtigungen pro Hyperbook zuweisen.

### Impersonation

Lehrkräfte und Admins können einen Schüler imitieren, um dessen Fortschritt im Nur-Lese-Modus einzusehen. Dabei wird das Hyperbook mit dem gespeicherten Zustand des Schülers geöffnet, ohne dass Änderungen möglich sind.

### Event-Log

Die Admin-Oberfläche bietet ein Event-Log pro Gruppe, das die letzten Events (letzte 200) und den neuesten Snapshot pro Schüler anzeigt. Lehrkräfte und Admins können:

- **Das Event-Log einsehen** — Alle aktuellen Datenbankänderungen aller Schüler einer Gruppe anzeigen.
- **Snapshots herunterladen** — Den zuletzt rekonstruierten Zustand eines Schülers als JSON-Datei herunterladen.

Snapshots werden mit ihrer Quelle gekennzeichnet: `auto` (automatisch erstellt, wenn der Event-Schwellenwert erreicht wird) oder `manual` (erstellt durch einen vollständigen Snapshot-Upload, Import oder Zurücksetzen).

## Datenfluss

### Änderungen speichern

```
Schüler interagiert mit dem Hyperbook
        ↓
Dexie-Hook erfasst Änderung als Event
        ↓
Events gebündelt (verzögert 2s / max 10s)
        ↓
POST /api/store/:hyperbookId/events
        ↓
Events auf dem Cloud-Server gespeichert
```

Wenn der Event-Batch 512 KB überschreitet:

```
Batch zu groß
        ↓
Vollständiger Dexie-Export erstellt
        ↓
POST /api/store/:hyperbookId/snapshot
        ↓
Snapshot ersetzt alle Events + vorherigen Snapshot
```

### Zustand laden

```
Schüler meldet sich an
        ↓
GET /api/store/:hyperbookId
        ↓
Server rekonstruiert Zustand (Snapshot + Events)
        ↓
Zustand in lokale IndexedDB importiert
        ↓
Interaktive Elemente wiederhergestellt
```

## API-Endpunkte

| Methode | Endpunkt | Beschreibung |
|---|---|---|
| `GET` | `/api/store/:hyperbookId` | Rekonstruierten Zustand abrufen (Snapshot + Event-Replay). |
| `POST` | `/api/store/:hyperbookId/events` | Einen Batch von Events anhängen. Enthält `afterEventId` zur Konflikterkennung. |
| `POST` | `/api/store/:hyperbookId/snapshot` | Vollständige Zustandsüberschreibung. Ersetzt alle Events und Snapshots. |

## Konfiguration

| Umgebungsvariable | Standard | Beschreibung |
|---|---|---|
| `SNAPSHOT_THRESHOLD` | `100` | Anzahl der Events, bevor der Server automatisch einen neuen Snapshot erstellt und alte Events bereinigt. |
