#!/usr/bin/env bash

set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
core_dir="$root_dir/notifly-kmp-sdk"
output_dir="$root_dir/build/notifly-core-sdk"
version="$(node -p "require('$root_dir/package.json').version")"

if [[ ! -x "$core_dir/gradlew" ]]; then
  echo "notifly-kmp-sdk submodule is not initialized. Run: git submodule update --init --recursive" >&2
  exit 1
fi

if [[ -z "${JAVA_HOME:-}" ]] && command -v brew >/dev/null 2>&1; then
  java_home="$(brew --prefix openjdk@17 2>/dev/null || true)/libexec/openjdk.jdk/Contents/Home"
  if [[ -x "$java_home/bin/java" ]]; then
    export JAVA_HOME="$java_home"
    export PATH="$JAVA_HOME/bin:$PATH"
  fi
fi

NPM_PACKAGE_NAME="notifly-core-sdk" \
VERSION="$version" \
"$core_dir/gradlew" \
  -p "$core_dir" \
  packJsPackage \
  --no-daemon

source_dir="$core_dir/build/packages/js"
test -f "$source_dir/package.json"

if [[ -d "$output_dir" ]]; then
  find "$output_dir" -depth -delete
fi
mkdir -p "$output_dir"
cp -R "$source_dir/." "$output_dir/"

node -e '
  const fs = require("node:fs");
  const manifest = require(process.argv[1]);
  manifest.repository = "https://github.com/team-michael/notifly-js-sdk";
  fs.writeFileSync(process.argv[1], `${JSON.stringify(manifest, null, 2)}\n`);
  if (manifest.name !== "notifly-core-sdk" || manifest.version !== process.argv[2]) {
    throw new Error(`unexpected Core package identity: ${manifest.name}@${manifest.version}`);
  }
' "$output_dir/package.json" "$version"

echo "Prepared notifly-core-sdk@$version at $output_dir"
