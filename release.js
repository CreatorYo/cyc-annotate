#!/usr/bin/env node

/**
 * Release helper script
 * Usage: node release.js [version]
 * Example: node release.js 1.3.1
 * 
 * This script will:
 * 1. Update version in package.json
 * 2. Build the app
 * 3. Show you what files to upload to GitHub
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const packageJsonPath = path.join(__dirname, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

// Get version from command line or prompt
const newVersion = process.argv[2]

if (!newVersion) {
  console.error('Usage: node release.js <version>')
  console.error('Example: node release.js 1.3.1')
  process.exit(1)
}

// Validate version format
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('Error: Version must be in format X.Y.Z (e.g., 1.3.1)')
  process.exit(1)
}

const currentVersion = packageJson.version

if (newVersion === currentVersion) {
  console.error(`Error: Version ${newVersion} is already the current version`)
  process.exit(1)
}

console.log(`\n📦 Preparing release: ${currentVersion} → ${newVersion}\n`)

// Update package.json version
packageJson.version = newVersion
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
console.log(`✓ Updated package.json version to ${newVersion}`)

// Build the app
console.log('\n🔨 Building app...\n')
try {
  execSync('npm run make', { stdio: 'inherit' })
  console.log('\n✓ Build completed successfully!\n')
} catch (error) {
  console.error('\n✗ Build failed!')
  // Revert version
  packageJson.version = currentVersion
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  process.exit(1)
}

// Show what to upload
const buildDir = path.join(__dirname, 'out', 'make', 'squirrel.windows', 'x64')
console.log('\n📤 Next steps:\n')
console.log('1. Go to: https://github.com/CreatorYo/cyc-annotate/releases/new')
console.log(`2. Create a new release with tag: v${newVersion}`)
console.log(`3. Upload these files from: ${buildDir}\n`)

if (fs.existsSync(buildDir)) {
  const files = fs.readdirSync(buildDir)
  const releasesFile = files.find(f => f === 'RELEASES')
  const nupkgFiles = files.filter(f => f.endsWith('.nupkg'))
  const exeFile = files.find(f => f.endsWith('Setup.exe'))
  
  console.log('   Required files:')
  if (releasesFile) console.log(`   - ${releasesFile}`)
  nupkgFiles.forEach(f => console.log(`   - ${f}`))
  
  if (exeFile) {
    console.log('\n   Optional (for direct download):')
    console.log(`   - ${exeFile}`)
  }
}

console.log('\n✅ Done! After uploading to GitHub, users will be able to update automatically.\n')

