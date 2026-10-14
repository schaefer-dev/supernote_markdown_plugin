# Build validation — 2026-10-14

## Desktop evidence

- TypeScript strict checks passed.
- 41 automated tests passed across Markdown parsing/section selection, layout and overflow, sequential import orchestration, and the SDK adapter.
- The official Android native build compiled the Kotlin bridge and produced the trimmed host-compatible native package.
- Installer inspection verifies manifest identity, registry key, declared permissions, bundle, icon, native ReactPackage registration and DEX bridge classes.
- A local parse of the Autohaus example yielded 41 blocks and 8 headings. The question section includes all three numbered questions, and YAML frontmatter is excluded. The source was read from the existing vault; neither its content nor a copy is in this repository.
- ADB reported no attached devices. No tablet files were changed or synced.

Build toolchain: Node 24.21.0, JDK 21.0.12.1, Gradle 8.13, Android SDK 35 / Build Tools 35.0.0. The project requests NDK 27.1.12297006; the SDK's own Android module also resolves NDK 27.0.12077973. Packaging comes from official template 1.0.13, React Native 0.79.2 and sn-plugin-lib 0.2.3.

The build tools used for this session are isolated under `/private/tmp/supernote-toolchains`, and do not change the default system Java or Node. That directory is temporary. For future builds, install the components through Android Studio and your preferred JDK/Node distribution as described in the README, or point local build environment variables to a retained installation.

Compatible patches updated markdown-it to 14.3.2 and the React Native CLI packages to 18.0.1, resolving the parser finding and critical CLI advisories seen in the initial dependency graph. Upstream transitive findings remain in the React Native/tooling graph; upgrading the host-mandated React Native runtime needs separate compatibility work. The plugin declares no network permission and uses no network requests.

## Not established by these checks

Installer loading in the actual PluginHost, system-font acceptance and measurement agreement, native page-index behavior, text editing, handwriting preservation across tablet save/restart, and sync/viewer compatibility of plugin-generated files require a real Manta. See [DEVICE_ACCEPTANCE.md](DEVICE_ACCEPTANCE.md). No synthetic `.note` binary is fabricated to substitute for those checks.
