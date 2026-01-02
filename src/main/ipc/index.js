const initWindowsIpc = require('./windows.ipc');
const initSettingsIpc = require('./settings.ipc');
const initThemeIpc = require('./theme.ipc');
const initSystemIpc = require('./system.ipc');
const initDialogsIpc = require('./dialogs.ipc');
const initTrayIpc = require('./tray.ipc');
const initOnboardingIpc = require('./onboarding.ipc');
const initNotificationsIpc = require('./notifications.ipc');
const initScreenshotsIpc = require('./screenshots.ipc');
const initCaptureIpc = require('./capture.ipc');
const initShortcutsIpc = require('./shortcuts.ipc');

function init(context) {
  initWindowsIpc(context);
  initSettingsIpc(context);
  initThemeIpc(context);
  initSystemIpc(context);
  initDialogsIpc(context);
  initTrayIpc(context);
  initOnboardingIpc(context);
  initNotificationsIpc(context);
  initScreenshotsIpc(context);
  initCaptureIpc(context);
  initShortcutsIpc(context);
}

module.exports = { init };