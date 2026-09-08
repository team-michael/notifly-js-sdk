import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sdk = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const core = JSON.parse(readFileSync(new URL('../build/notifly-core-sdk/package.json', import.meta.url)));

assert.equal(core.name, 'notifly-core-sdk');
assert.equal(core.version, sdk.version);
assert.equal(sdk.dependencies['notifly-core-sdk'], sdk.version);

console.log(`Verified notifly-core-sdk@${core.version} as an exact Full SDK dependency.`);
