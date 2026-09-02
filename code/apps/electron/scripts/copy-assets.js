const fs = require('fs')
const path = require('path')

const dist = path.join(__dirname, '..', 'dist')
fs.copyFileSync(path.join(__dirname, '..', 'src', 'splash.html'), path.join(dist, 'splash.html'))
fs.copyFileSync(path.join(__dirname, '..', 'assets', 'icon.png'), path.join(dist, 'ember-icon.png'))
