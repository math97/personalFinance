const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

exports.default = async function afterPack({ appOutDir, packager }) {
  const isMac = packager.platform.name === 'mac'
  const resourcesDir = isMac
    ? path.join(appOutDir, `${packager.appInfo.productName}.app`, 'Contents', 'Resources')
    : path.join(appOutDir, 'resources')

  const backendDir = path.join(resourcesDir, 'backend')
  if (!fs.existsSync(backendDir)) return

  console.log('  • Pruning backend devDependencies…')
  execSync('npm prune --omit=dev', { cwd: backendDir, stdio: 'inherit' })
}
