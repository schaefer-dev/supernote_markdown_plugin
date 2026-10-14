import fs from 'fs';
import path from 'path';
import {parseMarkdown, sectionBlockIds, selectedBlocks} from '../src/core/markdown';

it('removes frontmatter while preserving source line ranges and German text', () => {
  const doc = parseMarkdown('\uFEFF---\r\nCreated: today\r\n---\r\n# Ä Ö Ü ß\r\n\r\n6.000 € → next');
  expect(doc.blocks.map(block => block.text)).toEqual(['Ä Ö Ü ß', '6.000 € → next']);
  expect(doc.blocks[0]?.sourceRange).toEqual([3, 4]);
});
it('selects sections with descendants without overlapping duplicates', () => {
  const doc = parseMarkdown('# Main\n\nIntro\n\n## A\n\nText A\n\n### Child\n\nText child\n\n## B\n\nText B');
  const main = sectionBlockIds(doc, 'b0');
  const a = sectionBlockIds(doc, 'b2');
  expect(a).toEqual(['b2', 'b3', 'b4', 'b5']);
  expect(selectedBlocks(doc, new Set([...main, ...a]))).toHaveLength(doc.blocks.length);
  expect(sectionBlockIds(doc, 'missing')).toEqual([]);
  expect(sectionBlockIds(doc, 'b1')).toEqual([]);
});
it('keeps whole-block styles but explains mixed inline styles', () => {
  const doc = parseMarkdown('**Whole bold**\n\n*Whole italic*\n\nPrice **including** tax and *fees*.');
  expect(doc.blocks[0]?.bold).toBe(true);
  expect(doc.blocks[1]?.italic).toBe(true);
  expect(doc.blocks[2]).toMatchObject({text: 'Price including tax and fees.', bold: false, italic: false});
  expect(doc.notices.join(' ')).toContain('Mixed inline');
});
it('keeps ordered numbering, nested bullets, tasks, labels and aliases', () => {
  const doc = parseMarkdown('3. Third\n4. Fourth\n   - Nested\n\n- [ ] Open\n- [x] Done\n\n[Docs](https://example.com) [[Note|Alias]] [[Target]]');
  expect(doc.blocks.map(block => block.text)).toEqual(['3. Third', '4. Fourth', '• Nested', '☐ Open', '☑ Done', 'Docs Alias Target']);
  expect(doc.blocks[2]?.indent).toBe(1);
});
it('preserves quotations, code whitespace, plain table rows and hard breaks', () => {
  const doc = parseMarkdown('> A quote\n\n```text\na\n  b\n```\n\n| A | B |\n|---|---|\n|1|2|\n\nfirst  \nsecond');
  expect(doc.blocks.map(block => block.text)).toEqual(['A quote', 'a\n  b', 'A | B', '1 | 2', 'first\nsecond']);
  expect(doc.blocks[0]?.italic).toBe(true);
  expect(doc.notices).toContain('Tables are imported as plain text rows.');
});
it('omits embeds and image-only blocks with a notice', () => {
  const doc = parseMarkdown('![Image](image.png)\n\n![[file.pdf]]\n\nRemaining words');
  expect(doc.blocks.map(block => block.text)).toEqual(['Remaining words']);
  expect(doc.notices).toContain('Images and embedded attachments are omitted.');
});
it('never executes embedded HTML and parses the synthetic reference fixture', () => {
  expect(parseMarkdown('<script>alert(1)</script>').blocks[0]?.text).toContain('<script>');
  const source = fs.readFileSync(path.join(__dirname, '../fixtures/meeting.md'), 'utf8');
  const doc = parseMarkdown(source);
  expect(doc.blocks.length).toBeGreaterThan(12);
  expect(doc.notices).toHaveLength(3);
});
