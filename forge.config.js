const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const fs = require('fs');
const path = require('path');

module.exports = {
  packagerConfig: {
    name: 'CYCAnnotate',
    executableName: 'CYCAnnotate',
    asar: true,
    icon: path.join(__dirname, 'icon'),
    ignore: [
      /^\/\.git/,
      /^\/node_modules\/\.cache/,
      /^\/out/,
      /^\/\.vscode/,
      /^\/\.idea/,
      /^\/\.DS_Store/,
      /^\/\.gitignore/,
      /^\/forge\.config\.js/,
      /^\/package-lock\.json/,
      /^\/\.github/,
      /^\/assets\/icons/,
      /^\/build\/appx/
    ],
    prune: true,
    overwrite: true
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-msix',
      config: {
        packageAssets: path.join(__dirname, 'build', 'appx'),
        manifestVariables: {
          publisher: 'CN=CreatorYoCreations',
          packageDisplayName: 'CYC Annotate',
          packageDescription: 'CYC Annotate - Screen annotation tool',
          packageName: 'creatoryocreations.cycannotate',
          identityName: 'creatoryocreations.cycannotate'
        },
        windowsSignOptions: {
          certificateFile: path.join(__dirname, 'devcert.pfx'),
          certificatePassword: 'devcert'
        }
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