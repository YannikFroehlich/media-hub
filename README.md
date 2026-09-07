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

## Windows-App bauen

Installer und portable `.exe` bauen:

```powershell
npm run electron:pack
```

Danach liegen unter `release\` zwei Dateien:

- `Media Hub-<version>-setup.exe` installiert Media Hub mit Startmenü- und Desktop-Verknüpfung.
- `Media Hub-<version>-portable.exe` läuft ohne Installation.

Nach dem Start erscheint ein Tray-Icon. Über das Tray-Menü lässt sich der Autostart mit Windows aktivieren ("Bei Windows-Start automatisch starten"), "Dashboard öffnen" öffnet `http://127.0.0.1:4173` im Standardbrowser, und "Beenden" stoppt den eingebetteten Server und schließt das Programm.

Die installierte Variante lässt sich über die Windows-Einstellungen deinstallieren. Bei der portablen Variante genügt es, den Autostart-Haken im Tray-Menü zu entfernen und die `.exe` zu löschen.

Die gespeicherte Hub-Konfiguration gehört zum Browserprofil und bleibt davon unberührt.

## Automatische Releases

Jeder Push beziehungsweise Merge auf `main` startet den Workflow `Windows release`. Er installiert die gesperrten Abhängigkeiten, führt alle Tests aus, baut Installer und portable EXE und veröffentlicht beide Dateien als neuestes GitHub Release. Der Workflow lässt sich außerdem manuell über GitHub Actions starten.
