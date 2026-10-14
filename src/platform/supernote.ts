import {FileUtils, PluginCommAPI, PluginFileAPI, PluginManager, PluginNoteAPI, RattaFileSelector} from 'sn-plugin-lib';
import type {ImportJournal, NoteContext, PlannedTextBox} from '../core/types';
import {bridge} from './bridge';

export interface SavedElement {
  number: number;
  type: number;
  text?: string;
  editable?: number;
  rect?: {left: number; top: number; right: number; bottom: number};
}

export interface SupernoteAdapter {
  ensurePermission(kind: 'READ' | 'WRITE'): Promise<void>;
  context(): Promise<NoteContext>;
  save(): Promise<void>;
  readElements(path: string, page: number): Promise<SavedElement[]>;
  backup(path: string, id: string): Promise<string>;
  writeJournal(journal: ImportJournal): Promise<void>;
  insertPage(path: string, page: number): Promise<void>;
  reload(): Promise<void>;
  jump(page: number): Promise<void>;
  insertText(box: PlannedTextBox): Promise<void>;
}

function unwrap<T>(response: unknown, action: string): T {
  const result = response as {success?: boolean; result?: T; error?: {code?: number; message?: string}} | null;
  if (!result?.success || result.result === undefined || result.result === null) {
    const locked = result?.error?.code === 1217;
    throw new Error(locked ? 'Unlock the notebook on your Supernote and reopen the plugin.' :
      `${action}: ${result?.error?.message ?? 'Supernote did not confirm success.'}`);
  }
  return result.result;
}
function confirm(response: unknown, action: string) {
  if (unwrap<boolean>(response, action) !== true) {throw new Error(`${action}: Supernote refused the operation.`);}
}

export class DeviceAdapter implements SupernoteAdapter {
  private storageRoot = '';

  async initialize() {
    const path = await PluginManager.getPluginDirPath();
    if (!path) {throw new Error('Supernote did not provide a plugin storage directory.');}
    this.storageRoot = path;
    await bridge().configureStorageRoot(path);
  }

  async ensurePermission(kind: 'READ' | 'WRITE') {
    const permission = `plugin.permission.FILE:${kind}`;
    if (await PluginManager.hasPermission(permission) === 1) {return;}
    const status = await PluginManager.requestPermission(permission,
      kind === 'READ' ? 'Read Markdown files and notebook pages.' : 'Insert editable text and create a recovery copy.');
    if (status !== 1 && status !== 2) {
      throw new Error(`File ${kind.toLowerCase()} access is required. Enable it in Settings → Apps → Plugins → Markdown Import.`);
    }
  }

  async context(): Promise<NoteContext> {
    const path = unwrap<string>(await PluginCommAPI.getCurrentFilePath(), 'Read notebook path');
    const page = unwrap<number>(await PluginCommAPI.getCurrentPageNum(), 'Read page number');
    if (!path.toLowerCase().endsWith('.note') || !Number.isInteger(page) || page < 0) {
      throw new Error('Open a native notebook before importing Markdown.');
    }
    const size = unwrap<{width: number; height: number}>(await PluginFileAPI.getPageSize(path, page), 'Read page size');
    if (![size.width, size.height].every(value => Number.isFinite(value) && value > 0)) {
      throw new Error('Supernote returned an invalid page size.');
    }
    return {path, page, ...size};
  }

  async save() {confirm(await PluginNoteAPI.saveCurrentNote(), 'Save notebook');}
  async reload() {confirm(await PluginCommAPI.reloadFile(), 'Reload notebook');}
  async jump(page: number) {confirm(await PluginCommAPI.jumpToPage(page), 'Navigate to page');}

  async readElements(path: string, page: number): Promise<SavedElement[]> {
    const elements = unwrap<Array<{numInPage: number; type: number; textBox?: {
      textContentFull?: string; textEditable?: number; textRect?: SavedElement['rect']}; recycle?: () => Promise<void>}>>(
      await PluginFileAPI.getElements(page, path), 'Read saved page');
    try {
      return elements.map(element => ({number: element.numInPage, type: element.type,
        text: element.textBox?.textContentFull, editable: element.textBox?.textEditable,
        rect: element.textBox?.textRect}));
    } finally {
      await Promise.all(elements.map(element => element.recycle?.()));
    }
  }

  async backup(path: string, id: string) {
    const exportDir = await FileUtils.getExportPath();
    const folder = `${exportDir}/Markdown Import Backups`;
    if (!await FileUtils.exists(folder) && !await FileUtils.makeDir(folder)) {
      throw new Error('Could not create the recovery-copy folder.');
    }
    const name = path.split('/').pop()?.replace(/\.note$/i, '') ?? 'Notebook';
    const copy = `${folder}/${name}-${id}.note`;
    if (await FileUtils.exists(copy)) {throw new Error('A recovery copy with this name already exists. Reopen the plugin.');}
    if (!await FileUtils.copyFile(path, copy)) {throw new Error('Could not create a recovery copy. Nothing was inserted.');}
    const [originalHash, copyHash] = await Promise.all([FileUtils.getFileMD5(path), FileUtils.getFileMD5(copy)]);
    if (!originalHash || originalHash !== copyHash) {throw new Error('Recovery-copy verification failed. Nothing was inserted.');}
    return copy;
  }

  async writeJournal(journal: ImportJournal) {
    await bridge().writePrivate('last-import.json', JSON.stringify(journal));
  }
  async lastJournal(): Promise<ImportJournal | null> {
    const data = await bridge().readPrivate('last-import.json');
    return data ? JSON.parse(data) as ImportJournal : null;
  }
  async insertPage(path: string, page: number) {
    confirm(await PluginFileAPI.insertNotePage({notePath: path, page, template: 'style_blank'}), 'Insert notebook page');
  }
  async insertText(box: PlannedTextBox) {
    confirm(await PluginNoteAPI.insertText({fontSize: box.fontSize, fontPath: box.fontPath,
      textContentFull: box.text, textRect: box.rect, textAlign: 0,
      textBold: box.bold ? 1 : 0, textItalics: box.italic ? 1 : 0,
      textFrameWidthType: 0, textFrameStyle: 0, textEditable: 0}), 'Insert text box');
  }

  async selectMarkdown(): Promise<{path: string; text: string} | null> {
    await this.ensurePermission('READ');
    const previous = await bridge().readPrivate('last-source.txt');
    const parent = previous?.slice(0, previous.lastIndexOf('/'));
    const paths = await RattaFileSelector.selectFile({selectType: 1, suffixList: ['md'], maxNum: 1,
      title: 'Choose Markdown', rightButtonText: 'Open', ...(parent ? {needSelectFolder: parent} : {})});
    const path = paths?.[0];
    if (!path) {return null;}
    const text = await bridge().readMarkdown(path);
    await bridge().writePrivate('last-source.txt', path);
    return {path, text};
  }

  async preview(context: NoteContext) {
    await this.ensurePermission('WRITE');
    await this.save();
    const pngPath = `${this.storageRoot}/page-preview.png`;
    confirm(await PluginFileAPI.generateNotePng({notePath: context.path, page: context.page,
      times: 1, pngPath, type: 1}), 'Generate page preview');
    // RN Image caches by URI; a query string invalidates a previous page snapshot.
    return `file://${pngPath}?v=${Date.now()}`;
  }
}
