const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const runtimePaths = [
    'lib/cjs',
    'lib/esm',
    'dist/index.js',
    'dist/index.min.js',
    'dist/index.global.js',
    'dist/index.global.min.js',
];

const bareKmpImport = /(?:require\(\s*|from\s+)["']notifly-kmp-sdk["']/;
const failures = [];

function collectJavaScriptFiles(relativePath) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
        failures.push(`${relativePath}: missing build output`);
        return [];
    }

    if (fs.statSync(absolutePath).isDirectory()) {
        return fs
            .readdirSync(absolutePath, { withFileTypes: true })
            .flatMap((entry) => collectJavaScriptFiles(path.join(relativePath, entry.name)));
    }

    return relativePath.endsWith('.js') ? [relativePath] : [];
}

const runtimeFiles = runtimePaths.flatMap(collectJavaScriptFiles);
for (const relativePath of runtimeFiles) {
    const absolutePath = path.join(root, relativePath);
    const source = fs.readFileSync(absolutePath, 'utf8');
    if (bareKmpImport.test(source)) {
        failures.push(`${relativePath}: contains a runtime notifly-kmp-sdk import`);
    }
}

if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
}

const commonJsSdk = require(path.join(root, 'lib/cjs/index.js'));
if (typeof commonJsSdk.default?.setUserId !== 'function') {
    console.error('lib/cjs/index.js: public setUserId export is missing');
    process.exit(1);
}

console.log('KMP is bundled into every runtime output without a bare package import.');
