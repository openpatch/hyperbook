---
name: Cloud
index: 3
lang: de
---

# Cloud

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
- **Externe Datenbanken** — Daten aus eingebetteten Tools wie SQL-IDE und LearnJ werden ebenfalls synchronisiert.

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

## Datenfluss

```
Schüler interagiert mit dem Hyperbook
        ↓
Lokaler Zustand gespeichert (IndexedDB)
        ↓
Cloud-Synchronisierung (verzögert, automatisch)
        ↓
POST /api/store/:hyperbookId
        ↓
Pro Benutzer auf dem Cloud-Server gespeichert
```

Wenn sich der Schüler auf einem anderen Gerät anmeldet:

```
Schüler meldet sich an
        ↓
GET /api/store/:hyperbookId
        ↓
Zustand in lokalen Speicher importiert
        ↓
Interaktive Elemente wiederhergestellt
```

## Import & Export

Cloud-Synchronisierung funktioniert zusammen mit der `importExport`-Funktion. Schüler können ihren Zustand weiterhin manuell als Datei exportieren und importieren, auch wenn die Cloud-Synchronisierung aktiv ist.
