const { execFileSync } = require('node:child_process');
const {
    mkdtempSync,
    mkdirSync,
    symlinkSync,
    copyFileSync,
    readFileSync,
    writeFileSync,
    existsSync,
    rmSync,
} = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const commit = '3b3b46cf48a1a1eb0861eddc4dc2e77391a721d3';
const core = require(path.join(root, 'build/notifly-core-sdk/package.json'));
const baseline = JSON.parse(execFileSync('git', ['show', commit + ':package.json'], { cwd: root, encoding: 'utf8' }));
if (core.version !== baseline.dependencies['notifly-core-sdk'])
    throw new Error('Build the pinned baseline Core version before creating the fixture.');
const fingerprint =
    commit +
    ':' +
    require('node:crypto')
        .createHash('sha256')
        .update(readFileSync(path.join(root, 'build/notifly-core-sdk', core.main)))
        .digest('hex');
const output = path.join(root, 'build/secure-storage-fixtures');
if (
    existsSync(path.join(output, 'commit')) &&
    readFileSync(path.join(output, 'commit'), 'utf8') === fingerprint &&
    existsSync(path.join(output, 'legacy-sdk.js'))
)
    process.exit(0);
const temporary = mkdtempSync(path.join(os.tmpdir(), 'notifly-baseline-'));
try {
    const archive = execFileSync('git', ['archive', commit], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', temporary], { input: archive });
    symlinkSync(path.join(root, 'node_modules'), path.join(temporary, 'node_modules'), 'dir');
    mkdirSync(path.join(temporary, 'build'), { recursive: true });
    symlinkSync(path.join(root, 'build/notifly-core-sdk'), path.join(temporary, 'build/notifly-core-sdk'), 'dir');
    execFileSync(
        process.execPath,
        [
            path.join(root, 'node_modules/rollup/dist/bin/rollup'),
            '-c',
            'rollup.global.config.js',
            '-o',
            'dist/legacy-sdk.js',
        ],
        { cwd: temporary, env: { ...process.env, NODE_ENV: 'development' }, stdio: 'inherit' }
    );
    mkdirSync(output, { recursive: true });
    copyFileSync(path.join(temporary, 'dist/legacy-sdk.js'), path.join(output, 'legacy-sdk.js'));
    writeFileSync(path.join(output, 'commit'), fingerprint);
} finally {
    rmSync(temporary, { recursive: true, force: true });
}
