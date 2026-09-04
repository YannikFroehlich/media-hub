import { app, Tray, Menu, shell, nativeImage, dialog } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, stopServer } from '../scripts/windows/server.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.MEDIA_HUB_PORT ?? 4173);

const webRoot = app.isPackaged
  ? join(process.resourcesPath, 'app')
  : join(__dirname, '..', 'dist', 'media-hub', 'browser');
const iconPath = join(webRoot, 'favicon.ico');

let tray = null;
let serverInstance = null;
let isQuitting = false;

function loginItemPath() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function buildMenu() {
  const { openAtLogin } = app.getLoginItemSettings({ path: loginItemPath() });
  return Menu.buildFromTemplate([
    { label: `Media Hub – Port ${PORT}`, enabled: false },
    { type: 'separator' },
    { label: 'Dashboard öffnen', click: () => shell.openExternal(`http://127.0.0.1:${PORT}/`) },
    { type: 'separator' },
    {
      label: 'Bei Windows-Start automatisch starten',
      type: 'checkbox',
      checked: openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, path: loginItemPath() }),
    },
    { type: 'separator' },
    { label: 'Beenden', click: () => app.quit() },
  ]);
}

app.on('before-quit', async (event) => {
  if (isQuitting) return;
  isQuitting = true;
  event.preventDefault();
  await stopServer(serverInstance);
  app.quit();
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    tray?.displayBalloon?.({ title: 'Media Hub', content: 'Media Hub läuft bereits.' });
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.solarlux.mediahub');
    try {
      serverInstance = await startServer({ root: webRoot, port: PORT });
    } catch (error) {
      dialog.showErrorBox('Media Hub', `Server konnte nicht gestartet werden:\n${error.message}`);
      app.quit();
      return;
    }
    tray = new Tray(nativeImage.createFromPath(iconPath));
    tray.setToolTip(`Media Hub – läuft auf Port ${PORT}`);
    tray.setContextMenu(buildMenu());
  });
}
