# Media Hub

Media Hub ist ein lokales, TV-taugliches Dashboard für Medien, Websites und häufig verwendete Tools. Gruppen, Verknüpfungen, Farben und das Erscheinungsbild lassen sich direkt in der Oberfläche anpassen und werden ausschließlich im Browser gespeichert.

## Enthaltene Funktionen

- mehrere Dashboard-Profile mit eigenen Gruppen und eigenem Erscheinungsbild, umschaltbar über die Einstellungen
- responsives 16:9-Dashboard mit Dark- und Light-Theme sowie den Stilen Klassisch und Liquid Glass
- Gruppen und Verknüpfungen erstellen, bearbeiten, löschen und per Drag-and-drop sortieren
- sichere URL- und Sucheingabe mit konfigurierbarer Suchmaschine
- Font-Awesome-Iconkatalog, eigene Icon-Klassen und frei wählbare Akzentfarben
- Tastaturkürzel: `/` fokussiert die Suche, `E` schaltet den Editiermodus, `Esc` schließt Sidepanels
- Pfeilnavigation für die zentralen Bedienelemente und Tastatur-Sortierung an den Handles
- lokale Speicherung mit Backup sowie validierter JSON-Import und -Export

## Entwicklung

Voraussetzung ist Node.js 24 LTS.

```powershell
npm ci
npm start
```

Die Entwicklungsansicht läuft standardmäßig unter `http://localhost:4200`.

## Prüfen

```powershell
npm test -- --watch=false
npm run build
```

Der Production-Build liegt anschließend unter `dist/media-hub/browser`.

## Deployment

Die App wird über Vercel gehostet (`vercel.json`): `npm ci`, `npm run build` und Auslieferung von
`dist/media-hub/browser`.

## CI

Jeder Push beziehungsweise Merge auf `main` und jeder Pull Request gegen `main` startet den
CI-Workflow mit Lint, Tests, Produktions-Build und End-to-End-Tests.
