#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUBMODULE_DIR="$ROOT_DIR/notifly-kmp-sdk"
CI_WORKFLOW="$ROOT_DIR/.github/workflows/ci.yml"
BUMP_WORKFLOW="$ROOT_DIR/.github/workflows/bump-kmp-submodule.yml"

expected_url="https://github.com/notifly-tech/notifly-kmp-sdk.git"
actual_url="$(git -C "$ROOT_DIR" config -f .gitmodules --get submodule.notifly-kmp-sdk.url)"
if [[ "$actual_url" != "$expected_url" ]]; then
  echo "Expected KMP submodule URL $expected_url, got $actual_url" >&2
  exit 1
fi

if [[ ! -f "$SUBMODULE_DIR/gradlew" ]]; then
  echo "KMP submodule is not initialized" >&2
  exit 1
fi

if ! git -C "$SUBMODULE_DIR" describe --exact-match --tags HEAD >/dev/null 2>&1; then
  echo "KMP submodule must point to a tagged commit" >&2
  exit 1
fi

grep -F "submodules: recursive" "$CI_WORKFLOW" >/dev/null
grep -F "workflow_dispatch:" "$BUMP_WORKFLOW" >/dev/null
grep -F "https://github.com/notifly-tech/notifly-kmp-sdk.git" "$BUMP_WORKFLOW" >/dev/null
grep -F "gh workflow run ci.yml" "$BUMP_WORKFLOW" >/dev/null
grep -F "<rootDir>/notifly-kmp-sdk/" "$ROOT_DIR/jest.config.js" >/dev/null
grep -F "'/notifly-kmp-sdk/**'" "$ROOT_DIR/.eslintrc.cjs" >/dev/null

node -e '
const manifest = require("./package.json");
for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
  if (manifest[section]?.["notifly-kmp-sdk"]) {
    throw new Error(`notifly-kmp-sdk must not be declared in ${section}`);
  }
}
' 

"$ROOT_DIR/scripts/build_kmp_js.sh"

node -e '
const sdk = require("notifly-kmp-sdk");
const decision = sdk.tech.notifly.kmp.identity.UserIdTransitionPolicy.evaluate(null, "user-1");
if (!decision.changed || !decision.shouldSync) {
  throw new Error("Generated KMP package did not execute the shared policy");
}
'

echo "JavaScript builds and loads KMP from the tagged submodule."
