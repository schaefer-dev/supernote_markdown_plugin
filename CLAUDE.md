# Supernote Markdown Import

React Native 0.79.2 / TypeScript tablet plugin, built with the official Supernote template 1.0.13 and sn-plugin-lib 0.2.3. Initial target: Manta, Chauvet 3.30.45. Releases are experimental until real-device acceptance is recorded.

## Related project: Supernote Viewer

The companion macOS project lives at [`../supernote_viewer`](../supernote_viewer). Read its [CLAUDE.md](../supernote_viewer/CLAUDE.md) and [README.md](../supernote_viewer/README.md) for notebook parsing, native text boxes, saved canvas dimensions and PDF/Quick Look rendering.

- This plugin creates editable text boxes and pages through the official tablet SDK. Supernote Viewer reads the saved output on the Mac.
- Keep text-box semantics and compatibility changes aligned across both projects. Android SDK page coordinates differ from stored notebook coordinates; use `getPageSize`, not viewer canvas constants.
- Validate saved output in Supernote Viewer after plugin changes that affect text, layout or pages. Use synthetic device-generated fixtures, not personal notebooks or Obsidian files.
- Do not add direct `.note` rewriting, cloud credentials, or automatic two-way Markdown sync as an import shortcut.

## Implementation rules

- Pure parsing, section selection and pagination live in `src/core`; keep SDK calls behind `src/platform/supernote.ts` and Android file/text-measurement calls behind `src/platform/bridge.ts`.
- Imported words must remain real native text; `textEditable: 0` means editable. Apply whole-box formatting and explain unsupported Markdown in the preview.
- Check declared file permissions when used. Save before file-level reads/writes; reload after changing pages. Read back saved text before reporting success.
- Make and hash-verify a recovery copy before mutations. Persist progress before each write; never automatically replay an uncertain operation or restore over newer handwriting.
- Do not change the persistent plugin ID or host React Native version casually. Package the native bridge into the `.snplg`; a JS-only bundle is insufficient.
- Keep `buildPlugin.sh` aligned with the official template. The local fixes make native packaging fail closed and prevent stale packages from appearing successful.

## Commands

- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run build` (Node LTS, JDK 21, Android SDK 35 / Build Tools 35.0.0)
- Viewer checks: `cd ../supernote_viewer/SupernoteKit && swift test`

See [README.md](README.md) and [docs/DEVICE_ACCEPTANCE.md](docs/DEVICE_ACCEPTANCE.md). A desktop build or mocked SDK test does not establish tablet stability. Never mark unperformed device checks as passed.
