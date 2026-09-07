#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KMP_DIR="$ROOT_DIR/notifly-kmp-sdk"

if [[ ! -x "$KMP_DIR/gradlew" ]]; then
  echo "notifly-kmp-sdk is not initialized. Run: git submodule update --init --recursive" >&2
  exit 1
fi

if [[ -z "${JAVA_HOME:-}" ]] && command -v brew >/dev/null 2>&1; then
  brew_prefix="$(brew --prefix openjdk@17 2>/dev/null || true)"
  java_home="$brew_prefix/libexec/openjdk.jdk/Contents/Home"
  if [[ -x "$java_home/bin/java" ]]; then
    export JAVA_HOME="$java_home"
    export PATH="$JAVA_HOME/bin:$PATH"
  fi
fi

if ! java -version >/dev/null 2>&1; then
  echo "Java 17 or newer is required to build the KMP JavaScript package" >&2
  exit 1
fi

kmp_tag="$(git -C "$KMP_DIR" describe --exact-match --tags HEAD)"
kmp_version="${kmp_tag#v}"

(
  cd "$KMP_DIR"
  VERSION="$kmp_version" ./gradlew :kmp:packJsPackage --no-daemon --console=plain
)

tarball="$KMP_DIR/kmp/build/packages/notifly-kmp-sdk-$kmp_version.tgz"
if [[ ! -f "$tarball" ]]; then
  echo "KMP JavaScript package was not created: $tarball" >&2
  exit 1
fi

cd "$ROOT_DIR"
npm install --no-save --package-lock=false --ignore-scripts "$tarball"
