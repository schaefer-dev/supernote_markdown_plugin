import {Importer, ImportFailure} from '../src/core/importer';
import type {ImportJournal, ImportPlan, NoteContext, PlannedTextBox} from '../src/core/types';
import type {SavedElement, SupernoteAdapter} from '../src/platform/supernote';

const context: NoteContext = {path: '/Note/test.note', page: 1, width: 1000, height: 1400};
const box: PlannedTextBox = {blockId: 'b0', text: 'Editable words', fontSize: 25,
  fontPath: '/system/fonts/Roboto-Regular.ttf', bold: false, italic: false,
  rect: {left: 50, top: 50, right: 900, bottom: 200}};
function plan(mode: ImportPlan['mode'] = 'current-area'): ImportPlan {
  return {context, mode, sourcePath: '/Document/demo.md', pages: [[box], [{...box, text: 'Second page'}]].slice(0, mode === 'new-pages' ? 2 : 1)};
}
function mockDevice() {
  let current = {...context};
  const original: SavedElement = {number: 1, type: 0};
  const pages = new Map<number, SavedElement[]>([[1, [original]]]);
  const journal: ImportJournal[] = [];
  const events: string[] = [];
  const device: SupernoteAdapter = {
    ensurePermission: jest.fn(async kind => {events.push(kind);}),
    context: jest.fn(async () => ({...current})),
    save: jest.fn(async () => {events.push('save');}),
    backup: jest.fn(async () => {events.push('backup'); return '/EXPORT/recovery.note';}),
    writeJournal: jest.fn(async value => {journal.push(JSON.parse(JSON.stringify(value)));}),
    readElements: jest.fn(async (_, page) => {events.push('read'); return [...(pages.get(page) ?? [])];}),
    insertPage: jest.fn(async (_, page) => {events.push('insertPage'); pages.set(page, []);}),
    reload: jest.fn(async () => {events.push('reload');}),
    jump: jest.fn(async page => {events.push('jump'); current.page = page;}),
    insertText: jest.fn(async value => {
      events.push('insertText');
      const list = pages.get(current.page)!;
      list.push({number: list.length + 1, type: 500, text: value.text, rect: value.rect, editable: 0});
    }),
  };
  return {device, events, pages, journal};
}
it('creates backup before text, preserves existing strokes and verifies saved editable boxes', async () => {
  const {device, events, pages, journal} = mockDevice();
  const result = await new Importer(device).run(plan());
  expect(result).toMatchObject({status: 'complete', insertedBoxes: 1, verifiedPages: [1]});
  expect(events.indexOf('save')).toBeLessThan(events.indexOf('backup'));
  expect(events.indexOf('backup')).toBeLessThan(events.indexOf('insertText'));
  expect(pages.get(1)?.[0]).toEqual({number: 1, type: 0});
  expect(journal.some(value => value.pendingOperation?.startsWith('Insert text'))).toBe(true);
});
it('inserts pages in order, saves before page changes, reloads and returns to first new page', async () => {
  const {device, events} = mockDevice();
  const result = await new Importer(device).run(plan('new-pages'));
  expect(result.createdPages).toEqual([2, 3]);
  expect(result.verifiedPages).toEqual([2, 3]);
  expect(events.filter(value => value === 'insertPage')).toHaveLength(2);
  events.forEach((value, index) => {if (value === 'insertPage') {expect(events[index - 1]).toBe('save');}});
  expect(device.jump).toHaveBeenLastCalledWith(2);
});
it('refuses permissions or a changed context before writing', async () => {
  const first = mockDevice();
  (first.device.ensurePermission as jest.Mock).mockRejectedValue(new Error('Permission denied'));
  await expect(new Importer(first.device).run(plan())).rejects.toThrow('Permission denied');
  expect(first.device.backup).not.toHaveBeenCalled();
  const second = mockDevice();
  (second.device.context as jest.Mock).mockResolvedValue({...context, page: 9});
  await expect(new Importer(second.device).run(plan())).rejects.toThrow('page changed');
  expect(second.device.insertText).not.toHaveBeenCalled();
});
it('does not write if backup or journal creation fails', async () => {
  for (const failAt of ['backup', 'writeJournal'] as const) {
    const {device} = mockDevice();
    (device[failAt] as jest.Mock).mockRejectedValue(new Error('Disk full'));
    await expect(new Importer(device).run(plan())).rejects.toThrow('Disk full');
    expect(device.insertText).not.toHaveBeenCalled();
  }
});
it('stops on partial insertion and disallows replay of the same plan', async () => {
  const {device, journal} = mockDevice();
  const importPlan = plan(); importPlan.pages[0]!.push({...box, text: 'Fail here'});
  (device.insertText as jest.Mock).mockImplementationOnce(async () => {}).mockRejectedValue(new Error('Host write failed'));
  const importer = new Importer(device);
  await expect(importer.run(importPlan)).rejects.toThrow('Host write failed');
  expect(journal[journal.length - 1]).toMatchObject({status: 'failed', insertedBoxes: 1,
    pendingOperation: 'Insert text 2 on page 2'});
  await expect(importer.run(importPlan)).rejects.toThrow('already been attempted');
  expect(device.insertText).toHaveBeenCalledTimes(2);
});
it('does not report success if saved content is missing or noneditable', async () => {
  const {device} = mockDevice();
  (device.readElements as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([
    {number: 1, type: 500, text: box.text, rect: box.rect, editable: 1},
  ]);
  await expect(new Importer(device).run(plan())).rejects.toThrow('Saved editable text');
});
it('does not report success when existing elements disappear', async () => {
  const {device} = mockDevice();
  (device.readElements as jest.Mock).mockResolvedValueOnce([{number: 9, type: 0}]).mockResolvedValueOnce([]);
  await expect(new Importer(device).run(plan())).rejects.toThrow('Existing page elements');
});
it('refuses concurrent submissions', async () => {
  const {device} = mockDevice();
  let release!: () => void;
  (device.backup as jest.Mock).mockImplementation(() => new Promise<string>(resolve => {release = () => resolve('/EXPORT/recovery.note');}));
  const importer = new Importer(device);
  const first = importer.run(plan());
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  await expect(importer.run(plan())).rejects.toBeInstanceOf(ImportFailure);
  release(); await first;
  expect(device.insertText).toHaveBeenCalledTimes(1);
});
it('checks new page dimensions before inserting any text', async () => {
  const {device} = mockDevice();
  (device.context as jest.Mock).mockResolvedValueOnce(context).mockResolvedValueOnce(context)
    .mockResolvedValueOnce({...context, page: 2, width: 1400, height: 1000});
  await expect(new Importer(device).run(plan('new-pages'))).rejects.toThrow('unexpected size');
  expect(device.insertText).not.toHaveBeenCalled();
});
it('refuses malformed destination boxes before permissions, backup or mutation', async () => {
  const {device} = mockDevice();
  const bad = plan(); bad.pages[0]![0] = {...box, rect: {...box.rect, right: 2000}};
  await expect(new Importer(device).run(bad)).rejects.toThrow('preview is invalid');
  expect(device.ensurePermission).not.toHaveBeenCalled();
  expect(device.backup).not.toHaveBeenCalled();
});
