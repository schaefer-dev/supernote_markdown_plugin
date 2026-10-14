import type {SupernoteAdapter, SavedElement} from '../platform/supernote';
import type {ImportJournal, ImportPlan, NoteContext, PlannedTextBox} from './types';
import {validRect} from './layout';

export class ImportFailure extends Error {
  constructor(message: string, public readonly journal?: ImportJournal) {super(message);}
}
function sameContext(first: NoteContext, second: NoteContext) {
  return first.path === second.path && first.page === second.page &&
    first.width === second.width && first.height === second.height;
}
function matchingBox(element: SavedElement, box: PlannedTextBox) {
  return element.type === 500 && element.text === box.text && element.editable === 0 &&
    !!element.rect && (['left', 'top', 'right', 'bottom'] as const).every(key =>
      Math.abs(element.rect![key] - box.rect[key]) <= 2);
}

export class Importer {
  private busy = false;
  // A failed or interrupted attempt must never be blindly retried with a stale plan.
  private attempted = new WeakSet<ImportPlan>();
  constructor(private readonly device: SupernoteAdapter) {}

  async run(plan: ImportPlan, onProgress: (message: string) => void = () => {}): Promise<ImportJournal> {
    if (this.busy) {throw new ImportFailure('An import is already running.');}
    if (this.attempted.has(plan)) {throw new ImportFailure('This import has already been attempted. Reopen the plugin before another import.');}
    if (!plan.pages.length || plan.pages.some(page => !page.length || page.some(box =>
          !box.text || !Number.isFinite(box.fontSize) || box.fontSize <= 0 || !validRect(box.rect, plan.context))) ||
        plan.mode === 'current-area' && plan.pages.length !== 1) {
      throw new ImportFailure('The import preview is invalid. Prepare it again.');
    }
    this.busy = true;
    let journal: ImportJournal | undefined;
    try {
      await this.device.ensurePermission('READ');
      await this.device.ensurePermission('WRITE');
      if (!sameContext(plan.context, await this.device.context())) {
        throw new Error('The notebook or page changed. Reopen the plugin and prepare the import again.');
      }
      await this.device.save();
      const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
      const backupPath = await this.device.backup(plan.context.path, id);
      journal = {id, notePath: plan.context.path, sourcePath: plan.sourcePath, backupPath,
        status: 'prepared', createdPages: [], verifiedPages: [], insertedBoxes: 0};
      await this.device.writeJournal(journal);
      this.attempted.add(plan);
      journal.status = 'writing';

      for (let index = 0; index < plan.pages.length; index++) {
        const page = plan.mode === 'new-pages' ? plan.context.page + index + 1 : plan.context.page;
        // Detect changes before any page mutation. Navigation in our own loop is expected.
        const expectedPage = index === 0 ? plan.context.page : page - 1;
        const current = await this.device.context();
        if (current.path !== plan.context.path || current.page !== expectedPage) {
          throw new Error('The notebook changed during import. Import stopped.');
        }
        if (plan.mode === 'new-pages') {
          await this.device.save();
          journal.pendingOperation = `Insert page ${page + 1}`;
          await this.device.writeJournal(journal);
          await this.device.insertPage(plan.context.path, page);
          journal.createdPages.push(page);
          await this.device.writeJournal(journal);
          await this.device.reload();
          await this.device.jump(page);
          const destination = await this.device.context();
          if (destination.path !== plan.context.path || destination.page !== page ||
              destination.width !== plan.context.width || destination.height !== plan.context.height) {
            throw new Error('The new page has an unexpected size or position. Import stopped.');
          }
        }
        await this.device.save();
        const before = await this.device.readElements(plan.context.path, page);
        const boxes = plan.pages[index]!;
        for (let boxIndex = 0; boxIndex < boxes.length; boxIndex++) {
          onProgress(`Page ${index + 1}/${plan.pages.length} · text ${boxIndex + 1}/${boxes.length}`);
          journal.pendingOperation = `Insert text ${boxIndex + 1} on page ${page + 1}`;
          await this.device.writeJournal(journal);
          const target = await this.device.context();
          if (target.path !== plan.context.path || target.page !== page) {throw new Error('The active page changed. Import stopped.');}
          await this.device.insertText(boxes[boxIndex]!);
          journal.insertedBoxes++;
          await this.device.writeJournal(journal);
        }
        await this.device.save();
        const after = await this.device.readElements(plan.context.path, page);
        for (const original of before) {
          if (!after.some(element => element.number === original.number && element.type === original.type &&
              element.text === original.text)) {
            throw new Error('Existing page elements could not be verified. Keep the recovery copy.');
          }
        }
        const remaining = after.filter(element => !before.some(original => original.number === element.number));
        for (const box of boxes) {
          const found = remaining.findIndex(element => matchingBox(element, box));
          if (found < 0) {throw new Error('Saved editable text could not be verified. Keep the recovery copy.');}
          remaining.splice(found, 1);
        }
        journal.verifiedPages.push(page);
        journal.pendingOperation = undefined;
        await this.device.writeJournal(journal);
      }
      await this.device.reload();
      await this.device.jump(plan.mode === 'new-pages' ? plan.context.page + 1 : plan.context.page);
      journal.status = 'complete';
      await this.device.writeJournal(journal);
      return journal;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (journal) {
        journal.status = 'failed';
        journal.error = message;
        try {await this.device.writeJournal(journal);} catch { /* Keep the last durable pending-operation marker. */ }
      }
      throw new ImportFailure(message, journal);
    } finally {this.busy = false;}
  }
}
