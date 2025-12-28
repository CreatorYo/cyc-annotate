const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const fs = require('fs');
const path = require('path');

const isStoreBuild = process.env.STORE_BUILD === 'true';

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
        sign: !isStoreBuild,
        manifestVariables: {
          publisher: isStoreBuild 
            ? 'CN=D8CE1B84-55BC-4649-B982-017495080FFB' 
            : 'CN=CreatorYoCreations',
          publisherDisplayName: 'CreatorYo Creations',
          packageDisplayName: 'CYC Annotate',
          packageDescription: 'CYC Annotate - Screen annotation tool',
          packageName: 'CreatorYoCreations.CYCAnnotate',
          packageIdentity: 'CreatorYoCreations.CYCAnnotate',
          packageMinOSVersion: '10.0.26100.0'
        },
        ...(isStoreBuild ? {} : {
        windowsSignOptions: {
          certificateFile: path.join(__dirname, 'devcert.pfx'),
          certificatePassword: 'devcert'
        }
        })
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