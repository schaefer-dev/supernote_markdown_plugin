import {planImport, validRect} from '../src/core/layout';
import {parseMarkdown} from '../src/core/markdown';
import type {MeasureText, NoteContext} from '../src/core/types';

const context: NoteContext = {path: '/Note/test.note', page: 3, width: 1000, height: 1400};
const measure: MeasureText = async (text, width, style) => {
  const chars = Math.max(1, Math.floor(width / style.fontSize));
  const lines = [];
  for (let i = 0; i < text.length; i += chars) {lines.push({text: text.slice(i, i + chars), height: style.fontSize * 1.2});}
  return lines;
};
const defaults = {context, sourcePath: '/Document/demo.md', mode: 'new-pages' as const, preset: 'Normal' as const,
  fontPath: '/system/fonts/Roboto-Regular.ttf', measure};

it.each([{width: 1000, height: 1400}, {width: 1400, height: 1000}])('fits portrait and landscape bounds: %p', async size => {
  const plan = await planImport({...defaults, context: {...context, ...size}, blocks: parseMarkdown('# Title\n\n' + 'long text '.repeat(1000)).blocks});
  expect(plan.pages.length).toBeGreaterThan(1);
  expect(plan.pages.every(page => page.length && page.every(box => validRect(box.rect, size)))).toBe(true);
});
it('retains every character when splitting long words/URLs and blocks', async () => {
  const text = 'https://example.com/' + 'abcdefghijklmnopqrstuvwxyz'.repeat(300);
  const plan = await planImport({...defaults, blocks: parseMarkdown(text).blocks});
  expect(plan.pages.flat().map(box => box.text).join('')).toBe(text);
});
it('keeps a block together when it fits on the next page', async () => {
  const measureTwo: MeasureText = async text => [{text, height: 600}];
  const plan = await planImport({...defaults, measure: measureTwo, blocks: parseMarkdown('One\n\nTwo\n\nThree').blocks});
  expect(plan.pages.map(page => page.map(box => box.text))).toEqual([['One', 'Two'], ['Three']]);
});
it('rejects overflow on an existing page without returning truncated content', async () => {
  await expect(planImport({...defaults, mode: 'current-area', area: {left: 10, top: 10, right: 400, bottom: 120},
    blocks: parseMarkdown('A lot of text '.repeat(100)).blocks})).rejects.toThrow('does not fit');
});
it.each([undefined, {left: -1, top: 0, right: 50, bottom: 50}, {left: 0, top: 0, right: NaN, bottom: 50},
  {left: 0, top: 0, right: 1100, bottom: 50}, {left: 0, top: 0, right: 0, bottom: 50}])('rejects invalid areas %p', async area => {
  await expect(planImport({...defaults, mode: 'current-area', area, blocks: parseMarkdown('Text').blocks})).rejects.toThrow('inside');
});
it('supports size presets, headings and nested indentation', async () => {
  const blocks = parseMarkdown('# Heading\n\nBody\n\n- Item\n  - Child').blocks;
  const small = await planImport({...defaults, preset: 'Small', blocks});
  const large = await planImport({...defaults, preset: 'Large', blocks});
  expect(large.pages[0]?.[0]?.fontSize).toBeGreaterThan(small.pages[0]![0]!.fontSize);
  expect(large.pages[0]?.[0]?.bold).toBe(true);
  expect(large.pages[0]![3]!.rect.left).toBeGreaterThan(large.pages[0]![2]!.rect.left);
});
it('rejects empty selection, too-short area and broken measurement', async () => {
  await expect(planImport({...defaults, blocks: []})).rejects.toThrow('Select');
  await expect(planImport({...defaults, mode: 'current-area', area: {left: 0, top: 0, right: 800, bottom: 5},
    blocks: parseMarkdown('text').blocks})).rejects.toThrow('too short');
  await expect(planImport({...defaults, measure: async () => [{text: 'a', height: NaN}],
    blocks: parseMarkdown('text').blocks})).rejects.toThrow('measurement');
});
it('rejects a native measurement that drops characters', async () => {
  await expect(planImport({...defaults, measure: async () => [{text: 'truncated', height: 30}],
    blocks: parseMarkdown('Complete original words').blocks})).rejects.toThrow('measurement');
});
