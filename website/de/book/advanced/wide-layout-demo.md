---
name: Wide Layout Demo
layout: wide
index: 10
lang: de
---

# Wide Layout Demo

Diese Seite demonstriert das **Wide Layout** Feature, welches vollbreiten Inhalt mit Navigation im Drawer-Modus bietet.

## Hauptmerkmale des Wide Layouts

Das Wide Layout ist ideal für Seiten, die maximalen horizontalen Platz benötigen:

- **Vollbreiter Inhalt**: Der Inhalt erstreckt sich über die gesamte Seitenbreite mit Padding
- **Nur Drawer-Navigation**: Die Seitenleiste ist immer versteckt, Navigation erfolgt über das Hamburger-Menü
- **Responsives Design**: Funktioniert nahtlos auf allen Bildschirmgrößen
- **Einfache Konfiguration**: Einfach `layout: wide` zum Seiten-Frontmatter hinzufügen

## Verwendung

Um das Wide Layout zu verwenden, fügen Sie einfach die `layout` Eigenschaft zum Frontmatter Ihrer Seite hinzu:

```md
---
name: Meine Breite Seite
layout: wide
---

# Ihr Inhalt hier
```

## Wann Wide Layout verwenden

Erwägen Sie das Wide Layout für:

- **Datentabellen**: Seiten mit breiten Tabellen, die horizontalen Platz benötigen
- **Code-Beispiele**: Seiten mit langen Code-Snippets, die von breiterer Anzeige profitieren
- **Galerien**: Bildergalerien oder visueller Inhalt, der volle Breite benötigt
- **Interaktiver Inhalt**: Seiten mit eingebetteten interaktiven Elementen, die Platz benötigen
- **Präsentationen**: Inhalte, die in einem präsentationsähnlichen Format besser funktionieren

## Beispiel: Breite Tabelle

Hier ist eine Tabelle, die vom zusätzlichen horizontalen Platz des Wide Layouts profitiert:

| Merkmal | Standard Layout | Wide Layout | Beschreibung |
|---------|----------------|-------------|--------------|
| Inhaltsbreite | Begrenzt durch Seitenleiste | Volle Breite mit Padding | Wide Layout bietet mehr horizontalen Platz |
| Navigation | Seitenleiste auf Desktop immer sichtbar | Immer im Drawer-Modus | Maximiert Inhaltsbereich |
| Am besten für | Standard-Dokumentation | Tabellen, Galerien, Präsentationen | Wählen Sie basierend auf Inhaltsbedürfnissen |
| Mobile Verhalten | Verwendet Drawer-Navigation | Verwendet Drawer-Navigation | Konsistente mobile Erfahrung |
| Konfiguration | `layout: default` oder weglassen | `layout: wide` | Einfache Frontmatter-Option |

## Beispiel: Code-Block

```javascript
// Wide Layout bietet mehr horizontalen Platz für Code
function demonstriereWideLayout() {
  const merkmale = ['vollbreiter-inhalt', 'drawer-navigation', 'responsives-design'];
  return merkmale.map(merkmal => {
    console.log(`Wide Layout Merkmal: ${merkmal} - jetzt können Sie längere Zeilen ohne Scrollen sehen!`);
    return merkmal;
  });
}
```

## Vergleich

Wechseln Sie zwischen dieser Seite und anderen Dokumentationsseiten, um den Unterschied zwischen Standard- und Wide Layout zu sehen. Beachten Sie, wie sich der Inhaltsbereich auf dieser Seite über die volle Breite Ihres Browserfensters erstreckt, während Standardseiten eine Seitenleiste auf Desktop-Bildschirmen beibehalten.

---

**Hinweis**: Sie können jederzeit zum Standard-Layout zurückkehren, indem Sie die `layout` Eigenschaft entfernen oder auf `default` setzen.
