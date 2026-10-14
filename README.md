# Markdown Import for Supernote

Import selected sections or blocks from Markdown files into a native Supernote notebook as **editable text boxes**. Keep prepared reference material and handwriting together in the same notebook.

**0.1.0 is experimental.** The initial target is **Supernote Manta / Chauvet 3.30.45**. Desktop checks cannot establish tablet stability; actual device editing, restart and sync checks are tracked in [the acceptance checklist](docs/DEVICE_ACCEPTANCE.md).

## Use

1. Copy or sync a UTF-8 `.md` file into the tablet's `Document` folder (USB, Browse & Access, or your existing sync setup). A folder such as `Document/Markdown` works well. Only files up to 1 MB are accepted.
2. Install `dist/MarkdownImport-0.1.0-experimental.snplg`: copy it to `MyStyle`, then open **Settings → Apps → Plugins → Add Plugin**. Install the complete package, which includes an Android bridge.
3. Open the notebook and tap **Import Markdown**. Grant file read/write access when requested.
4. Choose a Markdown file and select individual blocks or **Whole section**. Nothing is selected by default. Select all is available.
5. Choose **New pages after this page**, or **Area on this page** and draw a rectangle on the existing-page preview. Drag again to adjust the rectangle.
6. Choose the text size, prepare the preview, inspect each page, then tap **Insert**.
7. Return to the notebook. Edit text with the normal Supernote text tools and add handwriting around it. Sync the saved notebook as usual and open it in Supernote Viewer on your Mac.

The plugin reads Markdown already on the tablet. It does not connect to your Mac, Obsidian account, or cloud provider. Imports are snapshots: changing the source Markdown does not automatically update notebook text, and notebook edits do not update the Markdown source.

## Formatting

| Markdown | Native result |
| --- | --- |
| Headings | Larger bold text boxes |
| Paragraphs | Editable text boxes |
| Whole-block bold/italic | Preserved |
| Mixed inline bold/italic | Words preserved; mixed styling removed |
| Numbered/bulleted/nested lists | Text markers and indentation |
| Tasks | Static checkbox characters, editable as text |
| Quotations | Italic text boxes |
| Code | Whitespace preserved in the system font |
| Links / Obsidian wikilinks | Labels / aliases as ordinary text |
| Tables | Plain rows separated by ` | ` |
| Images / Obsidian attachment embeds | Omitted with a notice |
| YAML frontmatter | Omitted |

New pages use a blank template and 5% margins. Normal body size is page width / 40, with smaller/larger presets and scaled headings. The measurement bridge resolves an installed Roboto or Noto Sans system font and supplies that exact path to the tablet text box. It adds spacing and frame padding conservatively; the preview approximates native rendering. Font acceptance and spacing still require device calibration.

Current-page insertion must fit completely in your selected rectangle. Choose free space: imported text can overlap existing content if you choose an occupied area. The plugin does not move handwriting or reflow other boxes when you subsequently edit the text. Long blocks can split into multiple text boxes on new pages. Imports are limited to 100 pages.

## Recovery

Before the first insertion, the plugin saves the notebook and creates a hash-verified copy in **EXPORT/Markdown Import Backups**. It writes a progress journal in its private storage before each operation and reads the saved page back before reporting completion.

If an import fails or the plugin closes unexpectedly, some changes may already have reached the notebook. The next plugin session shows the recovery-copy path, verified page count and last pending operation. Review the notebook before importing again. There is no automatic retry or automatic restore.

To restore, keep the current notebook separately first, then copy the recovery notebook to your normal `Note` location using the tablet's file manager or your Mac. The backup predates the import and any later handwriting. Manage old recovery copies manually through Files. Native Undo is available for live text insertion; the plugin does not claim one Undo reverses a multi-page import.

## Build

The project uses the official Supernote plugin template **1.0.13**, React Native **0.79.2**, and `sn-plugin-lib` **0.2.3**. Dependency versions are recorded in `package-lock.json`.

Requirements: Node LTS (22 or 24), npm, JDK 21, Android SDK Platform 35, Build Tools 35.0.0, NDK 27.1.12297006 and CMake 3.22.1. Android Studio's SDK Manager can install the Android components. Use a local `JAVA_HOME`; no global Java change is needed.

```sh
npm ci
npm run typecheck
npm test
JAVA_HOME=$(/usr/libexec/java_home -v 21) \
ANDROID_HOME="$HOME/Library/Android/sdk" npm run build
```

On another OS, set `JAVA_HOME` and `ANDROID_HOME` to your local installations. Python 3, Bash and ZIP utilities are required by packaging. A local, ignored `.toolchain-env` can export these variables.

The build uses the official `buildPlugin.sh` workflow, with two local corrections: native packaging failures stop the build, and stale generated output is removed before packaging. `scripts/verify-package.py` checks the installed manifest, ReactPackage registration, JavaScript bundle and Android DEX classes. A verified installer is copied into `dist/` with its SHA-256 checksum.

## Architecture and related project

- `src/core`: Markdown parsing, section selection, layout and sequential import orchestration.
- `src/platform`: official SDK adapter and typed Android bridge boundary.
- `src/ui`: scaled notebook/page previews and area selection; `App.tsx` provides the import workflow.
- `android/app`: UTF-8/private-file access and Android text measurement; bundled into the plugin's native package.
- `fixtures/meeting.md`: synthetic compatibility input. Personal Markdown files and tablet notebooks are not committed.

The companion [Supernote Viewer](../supernote_viewer/README.md) at `../supernote_viewer` renders the saved notebook on macOS. Its [CLAUDE.md](../supernote_viewer/CLAUDE.md) and [this project's CLAUDE.md](CLAUDE.md) document responsibilities and cross-project checks. Android SDK page dimensions and stored notebook pixel dimensions can differ; the plugin always uses SDK page dimensions.

## References and license

- [Official plugin setup](https://docs.supernote.com/en/first-plugin)
- [Editable text insertion](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-note-api/insert-text)
- [Save before file operations](https://docs.supernote.com/en/api-reference/supernote-plugin/plugin-note-api/save-current-note)
- [Plugin permissions](https://docs.supernote.com/en/plugin-base/permission)

MIT. The scaffold and packaging script originate from the MIT-licensed official Supernote template; see [third-party notices](THIRD_PARTY_NOTICES.md). This project is not affiliated with Ratta/Supernote.
