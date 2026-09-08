import { app, Tray, Menu, shell, nativeImage, dialog } from 'electron';
import electronUpdater from 'electron-updater';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, stopServer } from '../scripts/windows/server.mjs';

const { autoUpdater } = electronUpdater;
const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.MEDIA_HUB_PORT ?? 4173);
const RELEASES_URL = 'https://github.com/YannikFroehlich/media-hub/releases/latest';
const IS_PORTABLE = Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
const IS_SMOKE_TEST = process.env.MEDIA_HUB_SMOKE_TEST === '1';

const webRoot = app.isPackaged
  ? join(process.resourcesPath, 'app')
  : join(__dirname, '..', 'dist', 'media-hub', 'browser');
const iconPath = join(webRoot, 'favicon.ico');

let tray = null;
let serverInstance = null;
let isQuitting = false;
let isInstallingUpdate = false;
let manualUpdateCheck = false;
let showUpdateErrors = false;
let updateState = { status: 'idle', version: null, percent: null };

function loginItemPath() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function setUpdateState(status, { version = updateState.version, percent = null } = {}) {
  updateState = { status, version, percent };
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildMenu());
}

function updateMenuItem() {
  if (!app.isPackaged) {
    return { label: 'Updates sind im Entwicklungsmodus deaktiviert', enabled: false };
  }

  if (IS_PORTABLE) {
    return {
      label: 'Neueste Version herunterladen',
      click: () => shell.openExternal(RELEASES_URL),
    };
  }

  if (updateState.status === 'checking') {
    return { label: 'Suche nach Updates …', enabled: false };
  }

  if (updateState.status === 'downloading') {
    const progress = updateState.percent === null ? '' : ` (${updateState.percent} %)`;
    return { label: `Update wird heruntergeladen${progress}`, enabled: false };
  }

  if (updateState.status === 'available') {
    return {
      label: `Version ${updateState.version} herunterladen`,
      click: () => void downloadAvailableUpdate(),
    };
  }

  if (updateState.status === 'downloaded') {
    return {
      label: `Version ${updateState.version} installieren`,
      click: () => void installDownloadedUpdate(),
    };
  }

  return { label: 'Nach Updates suchen', click: () => void checkForUpdates(true) };
}

function buildMenu() {
  const { openAtLogin } = app.getLoginItemSettings({ path: loginItemPath() });
  return Menu.buildFromTemplate([
    { label: `Media Hub – Port ${PORT}`, enabled: false },
    { type: 'separator' },
    { label: 'Dashboard öffnen', click: () => shell.openExternal(`http://127.0.0.1:${PORT}/`) },
    updateMenuItem(),
    { type: 'separator' },
    {
      label: 'Bei Windows-Start automatisch starten',
      type: 'checkbox',
      checked: openAtLogin,
      click: (item) =>
        app.setLoginItemSettings({ openAtLogin: item.checked, path: loginItemPath() }),
    },
    { type: 'separator' },
    { label: 'Beenden', click: () => app.quit() },
  ]);
}

async function checkForUpdates(manual = false) {
  if (!app.isPackaged) {
    if (manual) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Media Hub',
        message: 'Die Update-Prüfung ist nur in der installierten Anwendung verfügbar.',
      });
    }
    return;
  }

  if (IS_PORTABLE) {
    await shell.openExternal(RELEASES_URL);
    return;
  }

  manualUpdateCheck = manual;
  showUpdateErrors = manual;
  setUpdateState('checking', { version: null });
  await autoUpdater.checkForUpdates().catch(() => {
    // The updater's error event presents user-facing failures when appropriate.
  });
}

async function downloadAvailableUpdate() {
  showUpdateErrors = true;
  setUpdateState('downloading');
  await autoUpdater.downloadUpdate().catch(() => {
    // The updater's error event handles the state and error message.
  });
}

async function installDownloadedUpdate() {
  if (isInstallingUpdate) return;
  isInstallingUpdate = true;
  await stopServer(serverInstance);
  serverInstance = null;
  autoUpdater.quitAndInstall(false, true);
}

function configureUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => setUpdateState('checking', { version: null }));

  autoUpdater.on('update-not-available', async () => {
    const showDialog = manualUpdateCheck;
    manualUpdateCheck = false;
    showUpdateErrors = false;
    setUpdateState('idle', { version: null });
    if (showDialog) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Media Hub',
        message: 'Media Hub ist bereits auf dem neuesten Stand.',
        detail: `Installierte Version: ${app.getVersion()}`,
      });
    }
  });

  autoUpdater.on('update-available', async (info) => {
    manualUpdateCheck = false;
    setUpdateState('available', { version: info.version });
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Media Hub – Update verfügbar',
      message: `Media Hub ${info.version} ist verfügbar.`,
      detail: `Installiert ist Version ${app.getVersion()}. Soll das Update jetzt heruntergeladen werden?`,
      buttons: ['Herunterladen', 'Später'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (response === 0) await downloadAvailableUpdate();
    else showUpdateErrors = false;
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdateState('downloading', { percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', async (info) => {
    showUpdateErrors = false;
    setUpdateState('downloaded', { version: info.version });
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Media Hub – Update bereit',
      message: `Media Hub ${info.version} wurde heruntergeladen.`,
      detail: 'Die Anwendung wird zum Installieren beendet und anschließend neu gestartet.',
      buttons: ['Jetzt installieren', 'Später'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (response === 0) await installDownloadedUpdate();
  });

  autoUpdater.on('error', async (error) => {
    const showDialog = showUpdateErrors;
    manualUpdateCheck = false;
    showUpdateErrors = false;
    setUpdateState('error');
    if (showDialog) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Media Hub – Update fehlgeschlagen',
        message: 'Das Update konnte nicht geprüft oder heruntergeladen werden.',
        detail: error.message,
      });
    }
  });
}

app.on('before-quit', async (event) => {
  if (isInstallingUpdate) return;
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
    configureUpdater();
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
    if (IS_SMOKE_TEST) {
      setTimeout(() => app.quit(), 3_000);
    } else if (app.isPackaged && !IS_PORTABLE) {
      setTimeout(() => void checkForUpdates(false), 10_000);
    }
  });
}
