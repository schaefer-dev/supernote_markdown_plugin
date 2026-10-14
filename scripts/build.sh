#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"
if [[ -f .toolchain-env ]]; then source .toolchain-env; fi
if [[ -z "${JAVA_HOME:-}" ]] && [[ "$(uname -s)" == Darwin ]]; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
fi
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
if [[ ! -d "$ANDROID_HOME/platforms/android-35" || ! -d "$ANDROID_HOME/build-tools/35.0.0" ]]; then
  echo "Install Android SDK Platform 35 and Build Tools 35.0.0, then set ANDROID_HOME." >&2
  exit 1
fi
npm run typecheck
# Remove previous generated packages so a failed native build cannot leave an apparent success.
rm -rf "$project_root/build/generated" "$project_root/build/outputs"
bash buildPlugin.sh "$project_root"
python3 scripts/verify-package.py build/outputs/supernote-markdown-plugin.snplg
mkdir -p dist
cp build/outputs/supernote-markdown-plugin.snplg dist/MarkdownImport-0.1.0-experimental.snplg
shasum -a 256 dist/MarkdownImport-0.1.0-experimental.snplg > dist/MarkdownImport-0.1.0-experimental.snplg.sha256
