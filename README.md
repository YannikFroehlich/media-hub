# Media Hub

Media Hub ist ein lokales, TV-taugliches Dashboard für Medien, Websites und häufig verwendete Tools. Gruppen, Verknüpfungen, Farben und das Erscheinungsbild lassen sich direkt in der Oberfläche anpassen und werden ausschließlich im Browser gespeichert.

## Enthaltene Funktionen

- responsives 16:9-Dashboard mit Dark- und Light-Theme
- Gruppen und Verknüpfungen erstellen, bearbeiten, löschen und per Drag-and-drop sortieren
- sichere URL- und Sucheingabe mit konfigurierbarer Suchmaschine
- Font-Awesome-Iconkatalog, eigene Icon-Klassen und frei wählbare Akzentfarben
- Tastaturkürzel: `/` fokussiert die Suche, `E` schaltet den Editiermodus, `Esc` schließt Sidepanels
- Pfeilnavigation für die zentralen Bedienelemente und Tastatur-Sortierung an den Handles
- lokale Speicherung mit Backup sowie validierter JSON-Import und -Export
- Windows-Startskripte für einen lokalen Server und ein maximiertes Chrome-Appfenster

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

## Lokal unter Windows installieren

PowerShell im Projektordner öffnen und ausführen:

```powershell
.\scripts\windows\install.ps1
```

Das Skript erstellt den Production-Build, installiert ihn unter `%LOCALAPPDATA%\MediaHub`, richtet den Autostart ein und öffnet Media Hub unter `http://127.0.0.1:4173` als Chrome-App. Ist Chrome nicht installiert, wird der Standardbrowser verwendet.

Deinstallation:

```powershell
.\scripts\windows\uninstall.ps1
```

Die gespeicherte Hub-Konfiguration gehört zum Browserprofil und wird durch die Deinstallation der lokalen Dateien nicht automatisch gelöscht.
