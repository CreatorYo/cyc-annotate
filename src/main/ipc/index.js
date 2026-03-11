const initWindowsIpc = require('./windows');
const initSettingsIpc = require('./settings');
const initThemeIpc = require('./theme');
const initSystemIpc = require('./system');
const initDialogsIpc = require('./dialogs');
const initTrayIpc = require('./tray');
const initOnboardingIpc = require('./onboarding');
const initNotificationsIpc = require('./notifications');
const initScreenshotsIpc = require('./screenshots');
const initCaptureIpc = require('./capture');
const initShortcutsIpc = require('./shortcuts');
const { init: initCustomSoundsIpc } = require('./customSounds');
const initWhiteboardIpc = require('./whiteboard');

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
  initCustomSoundsIpc(context);
  initWhiteboardIpc(context);
}

module.exports = { init };