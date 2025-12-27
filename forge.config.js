const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const fs = require('fs');
const path = require('path');

module.exports = {
  packagerConfig: {
    name: 'CYCAnnotate',
    executableName: 'CYC Annotate',
    asar: true
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-msix',
      config: {
        windowsKitVersion: '10.0.26100.0',
        manifestVariables: {
          publisher: 'CN=D8CE1B84-55BC-4649-B982-017495080FFB',
          packageIdentity: 'creatoryocreations.cycannotate',
          packageDisplayName: 'CYC Annotate',
          packageDescription: 'CYC Annotate Application',
          publisherDisplayName: 'CreatorYo Creations',
          appExecutable: 'CYC Annotate.exe',
          appDisplayName: 'CYC Annotate',
          targetArch: 'x64',
          packageVersion: '1.0.0.0',
          packageMinOSVersion: '10.0.17763.0',
          packageMaxOSVersionTested: '10.0.26100.0'
        },
        sign: false,
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    postMake: async (config, makeResults) => {
      const intermediateDir = path.join('out', 'CYCAnnotate-win32-x64');
      if (fs.existsSync(intermediateDir)) {
        fs.rmSync(intermediateDir, { recursive: true, force: true });
        console.log('✓ Cleaned up intermediate build directory');
      }
    }
  }
};