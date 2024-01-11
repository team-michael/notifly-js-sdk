const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

function generateSource(version) {
    return `export const SDK_VERSION = '${version}';\n`;
}

const version = packageJson.version;
const source = generateSource(version);
const file = path.resolve(__dirname, '../src/Version.ts');
fs.writeFileSync(file, source, { encoding: 'utf-8' });
