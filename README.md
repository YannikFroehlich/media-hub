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
- Windows-Tray-App (Electron) für Autostart und Serververwaltung

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

Portable `.exe` bauen:

```powershell
npm run electron:pack
```

Die fertige Datei liegt danach unter `release\Media Hub-<version>-portable.exe`. Einmal starten — ein Tray-Icon erscheint. Über das Tray-Menü lässt sich der Autostart mit Windows aktivieren ("Bei Windows-Start automatisch starten"), "Dashboard öffnen" öffnet `http://127.0.0.1:4173` im Standardbrowser, und "Beenden" stoppt den eingebetteten Server und schließt das Programm.

Zum Deinstallieren genügt es, den Autostart-Haken im Tray-Menü zu entfernen und die `.exe` zu löschen — es gibt keinen separaten Installer und keine Registry-Einträge außerhalb des Autostart-Eintrags.

Die gespeicherte Hub-Konfiguration gehört zum Browserprofil und bleibt davon unberührt.
