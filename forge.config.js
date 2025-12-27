const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const fs = require('fs');
const path = require('path');

const iconPath = path.join(__dirname, 'icon.png');
const iconPathWithoutExt = path.join(__dirname, 'icon');
if (!fs.existsSync(iconPath) && !fs.existsSync(iconPathWithoutExt + '.ico') && !fs.existsSync(iconPathWithoutExt + '.png')) {
  console.warn('Warning: Icon file not found at expected location:', iconPath);
}

module.exports = {
  packagerConfig: {
    name: 'CYCAnnotate',
    executableName: 'CYCAnnotate',
    asar: true,
    // Prefer .ico for Windows, fallback to .png
    icon: fs.existsSync(path.join(__dirname, 'icon.ico')) 
      ? path.join(__dirname, 'icon.ico')
      : path.join(__dirname, 'icon')
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'CYCAnnotate',
        authors: 'CreatorYoCreations',
        description: 'CYC Annotate - Screen annotation tool',
        setupIcon: fs.existsSync(path.join(__dirname, 'icon.ico')) 
          ? path.join(__dirname, 'icon.ico')
          : path.join(__dirname, 'icon.png'),
        loadingGif: undefined, // Use default loading animation
        setupExe: 'CYCAnnotate-Setup.exe',
        certificateFile: undefined, // Optional: path to certificate for code signing
        certificatePassword: undefined,
        // Create a proper installer with all standard features
        noMsi: false, // Also create MSI installer
        remoteReleases: undefined, // For auto-updates, set this to your update server
        remoteToken: undefined,
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