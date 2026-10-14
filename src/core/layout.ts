import type {ContentBlock, ImportPlan, MeasureText, NoteContext, Rect, TextPreset, TextStyle} from './types';

export class LayoutError extends Error {}
export function validRect(rect: Rect, size: {width: number; height: number}): boolean {
  return Object.values(rect).every(Number.isFinite) && rect.left >= 0 && rect.top >= 0 &&
    rect.right <= size.width && rect.bottom <= size.height && rect.right > rect.left && rect.bottom > rect.top;
}

export async function planImport(params: {
  blocks: ContentBlock[]; context: NoteContext; sourcePath: string;
  mode: ImportPlan['mode']; area?: Rect; preset: TextPreset; fontPath: string;
  measure: MeasureText;
}): Promise<ImportPlan> {
  const {blocks, context, mode, measure} = params;
  if (!blocks.length) {throw new LayoutError('Select some content first.');}
  const bodySize = Math.max(12, context.width / 40) * {Small: 0.85, Normal: 1, Large: 1.2}[params.preset];
  const margin = Math.round(context.width * 0.05);
  const area = mode === 'current-area' ? params.area : {
    left: margin, top: margin, right: context.width - margin, bottom: context.height - margin,
  };
  if (!area || !validRect(area, context)) {throw new LayoutError('Choose an area inside the page.');}
  const plan: ImportPlan = {context, mode, sourcePath: params.sourcePath, pages: [[]]};
  let page = plan.pages[0]!;
  let y = area.top;
  const gap = Math.ceil(bodySize * 0.45);

  function advancePage() {
    if (mode === 'current-area') {
      throw new LayoutError('This content does not fit. Choose smaller text, fewer blocks, a larger area, or new pages.');
    }
    if (plan.pages.length >= 100) {throw new LayoutError('Import is limited to 100 pages. Select a smaller section.');}
    page = [];
    plan.pages.push(page);
    y = area!.top;
  }

  for (const block of blocks) {
    const style: TextStyle = {fontSize: bodySize * (block.kind === 'heading' ?
      block.level === 1 ? 1.5 : block.level === 2 ? 1.25 : 1.1 : 1),
      fontPath: params.fontPath, bold: block.bold, italic: block.italic};
    const left = Math.round(area.left + block.indent * bodySize * 0.8);
    // Padding protects against the host's text frame inset and rounding.
    const padding = Math.ceil(style.fontSize * 0.25);
    const width = area.right - left - padding * 2;
    if (width < style.fontSize * 2) {throw new LayoutError('The selected area is too narrow for this text.');}
    const lines = await measure(block.text, width, style);
    if (!lines.length || lines.some(line => !Number.isFinite(line.height) || line.height <= 0) ||
        lines.map(line => line.text).join('') !== block.text) {
      throw new LayoutError('Text measurement failed. No content was inserted.');
    }
    const fullHeight = lines.reduce((sum, line) => sum + line.height, 0) + padding * 2;
    const pageHeight = area.bottom - area.top;
    // Keep a block together when it fits on a fresh page.
    if (fullHeight <= pageHeight && y + fullHeight > area.bottom) {advancePage();}
    let cursor = 0;
    while (cursor < lines.length) {
      let end = cursor;
      let height = padding * 2;
      while (end < lines.length && y + height + lines[end]!.height <= area.bottom) {
        height += lines[end]!.height;
        end++;
      }
      if (end === cursor) {
        if (y === area.top) {throw new LayoutError('The selected area is too short for one line.');}
        advancePage();
        continue;
      }
      page.push({...style, blockId: block.id,
        // Native measurements return substrings whose concatenation is lossless.
        text: lines.slice(cursor, end).map(line => line.text).join(''),
        rect: {left, top: Math.floor(y), right: Math.floor(area.right), bottom: Math.ceil(y + height)},
      });
      y = Math.ceil(y + height) + gap;
      cursor = end;
      if (cursor < lines.length) {advancePage();}
    }
  }
  return plan;
}
