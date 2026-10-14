# Device acceptance — 0.1.0 experimental

Initial target: **Manta, Chauvet 3.30.45**. Run against a synthetic notebook and `fixtures/meeting.md`. Keep originals of any personal notebook used later. Record actual firmware, SDK, installer SHA-256 and results below.

## Initial device checkpoint

- [ ] The complete `.snplg` installs and the NOTE toolbar button appears.
- [ ] The native bridge loads, locates plugin-private storage, resolves a system font and reads a UTF-8 Markdown file.
- [ ] A single imported multiline text box is editable, searchable and visible after save/reopen.
- [ ] The same font path and size used by Android measurement render correctly on the tablet. Check padding, long words, wrapping and bold/italic; adjust measurement only with recorded evidence.
- [ ] Page insertion creates a blank page after the current page, including insertion between two existing pages. Confirm zero-based API indices.
- [ ] New-page dimensions and orientation match the preview. Landscape import must either work correctly or stop before adding text.

## Complete import cycle

- [ ] Parent/child section selections do not duplicate content; individual blocks can be deselected.
- [ ] Headings, whole-block styles, lists, task markers, quotes, code, plain table rows and German characters render legibly.
- [ ] Image omission and mixed-format simplification are explained before import.
- [ ] Multi-page imports retain source order and every word; inspect split paragraphs and code blocks for clipping or gaps.
- [ ] Current-page rectangle selection maps correctly to the tablet page in portrait and landscape.
- [ ] Current-area overflow blocks insertion with no partial text.
- [ ] Existing handwriting, layers, text boxes, headings, links and following pages remain intact after both insertion modes.
- [ ] Imported text can be edited, moved and resized using native tools. Add handwriting afterward.
- [ ] Save and reopen; restart the tablet; reopen again. All imported and original content remains present and editable.
- [ ] Sync the notebook back to the Mac and inspect every affected page in Supernote Viewer and Finder Quick Look.

## Failure and recovery

- [ ] File-picker cancellation, missing source, invalid UTF-8, denied permissions and locked notebook produce useful messages.
- [ ] Reopening with one-session permission grants requests access again when needed.
- [ ] The recovery notebook matches the saved pre-import notebook and can be reopened.
- [ ] Double tapping Insert cannot create duplicate content.
- [ ] Closing/interruption during insertion leaves an actionable journal; pending operations are not automatically repeated.
- [ ] A failed import does not report success or automatically restore over newer changes.
- [ ] Preserve the modified notebook, manually restore the backup, and confirm original content is recoverable.

## Viewer fixture handoff

After a successful device cycle, create a small notebook containing only synthetic content and save the tablet's own PDF export alongside it for comparison. Add the notebook to Supernote Viewer's synthetic fixture set; retain model/firmware and provenance notes. Check native text extraction and visible layout with `cd ../supernote_viewer/SupernoteKit && swift test`. Do not use a constructed binary or personal notebook as a substitute.

## Recorded evidence

- Desktop parser/layout/import orchestration tests: see `docs/BUILD_VALIDATION.md`.
- Firmware/model: **not yet recorded**.
- Installer hash: see `dist/*.sha256`.
- Device editing/save/restart checks: **not performed**.
- Sync/viewer checks for plugin-generated output: **not performed**.

Do not describe the plugin as stable until these device checks are completed and any failures resolved. Recheck the cycle when upgrading firmware or the SDK.
