const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'notifly-js-sdk-smoke-'));

function run(command, args, cwd) {
    return childProcess.execFileSync(command, args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}

try {
    const packResult = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', temporaryDirectory], root));
    const archivePath = path.join(temporaryDirectory, packResult[0].filename);
    const consumerDirectory = path.join(temporaryDirectory, 'consumer');
    fs.mkdirSync(consumerDirectory);
    fs.writeFileSync(
        path.join(consumerDirectory, 'package.json'),
        JSON.stringify({ name: 'notifly-js-sdk-smoke-consumer', private: true, version: '1.0.0' })
    );

    run('npm', ['install', '--ignore-scripts', archivePath], consumerDirectory);

    const installedRoot = path.join(consumerDirectory, 'node_modules', 'notifly-js-sdk');
    const installedManifest = JSON.parse(fs.readFileSync(path.join(installedRoot, 'package.json'), 'utf8'));
    const noticesPath = path.join(installedRoot, 'THIRD_PARTY_NOTICES.md');
    if (!fs.existsSync(noticesPath) || !fs.readFileSync(noticesPath, 'utf8').includes('notifly-kmp-sdk')) {
        throw new Error('The packed SDK must include the bundled KMP license notice');
    }
    const runtimeDependencySections = ['dependencies', 'peerDependencies', 'optionalDependencies'];

    for (const section of runtimeDependencySections) {
        if (installedManifest[section]?.['notifly-kmp-sdk']) {
            throw new Error(`notifly-kmp-sdk must not appear in ${section}`);
        }
    }

    if (fs.existsSync(path.join(consumerDirectory, 'node_modules', 'notifly-kmp-sdk'))) {
        throw new Error('notifly-kmp-sdk was installed into the customer dependency tree');
    }

    const sdk = require(installedRoot).default;
    if (typeof sdk?.setUserId !== 'function') {
        throw new Error('The packed CommonJS SDK does not expose setUserId');
    }

    console.log('Packed SDK installs and loads without a runtime notifly-kmp-sdk dependency.');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
