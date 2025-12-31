const os = require('os')
const { execSync } = require('child_process')
const { systemPreferences } = require('electron')

function getWindowsVersion() {
  if (process.platform !== 'win32') return null
  
  try {
    let buildNumber = 0
    
    try {
      const result = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v CurrentBuild', 
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
      const match = result.match(/CurrentBuild\s+REG_SZ\s+(\d+)/)
      if (match) buildNumber = parseInt(match[1])
    } catch (e) {
      try {
        const result = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v CurrentBuildNumber',
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
        const match = result.match(/CurrentBuildNumber\s+REG_SZ\s+(\d+)/)
        if (match) buildNumber = parseInt(match[1])
      } catch (e2) {
        const parts = os.release().split('.')
        if (parts.length >= 3) buildNumber = parseInt(parts[2]) || 0
      }
    }
    
    let versionName = 'Windows'
    if (buildNumber >= 22000) versionName = 'Windows 11'
    else if (buildNumber >= 10240) versionName = 'Windows 10'
    else if (buildNumber >= 9200) versionName = 'Windows 8.1'
    else if (buildNumber >= 7600) versionName = 'Windows 7'
    
    let buildVersion = ''
    try {
      const result = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v DisplayVersion',
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
      const match = result.match(/DisplayVersion\s+REG_SZ\s+(.+)/)
      if (match) buildVersion = match[1].trim()
    } catch (e) {
      try {
        const result = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v ReleaseId',
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
        const match = result.match(/ReleaseId\s+REG_SZ\s+(.+)/)
        if (match) buildVersion = match[1].trim()
      } catch (e2) {}
    }
    
    return buildVersion ? `${versionName} (${buildVersion})` : versionName
  } catch (error) {
    const parts = os.release().split('.')
    if (parts.length >= 3) {
      const buildNum = parseInt(parts[2]) || 0
      if (buildNum >= 22000) return 'Windows 11'
      if (buildNum >= 10240) return 'Windows 10'
    }
    return 'Windows'
  }
}

function getWindowsAccentColor() {
  if (process.platform !== 'win32') return null
  
  try {
    if (systemPreferences.getAccentColor) {
      return `#${systemPreferences.getAccentColor()}`
    }
  } catch (e) {}
  
  try {
    const result = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\DWM" /v ColorizationColor',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
    const match = result.match(/0x([0-9a-fA-F]{8})/i)
    if (match) {
      const dword = parseInt(match[1], 16)
      const b = (dword >> 16) & 0xFF
      const g = (dword >> 8) & 0xFF
      const r = dword & 0xFF
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }
  } catch (e) {}
  
  return null
}

function getOsVersion() {
  if (process.platform === 'win32') return getWindowsVersion()
  if (process.platform === 'darwin') return `macOS ${os.release()}`
  return `${process.platform} ${os.release()}`
}

module.exports = { getWindowsVersion, getWindowsAccentColor, getOsVersion }
