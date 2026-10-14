import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import type {ContentBlock, ImportSelection, MarkdownDocument} from './types';

const parser = new MarkdownIt({html: false, linkify: false, typographer: false});

function readableObsidian(text: string, notices: Set<string>): string {
  return text
    .replace(/!\[\[[^\]]+\]\]/g, () => {
      notices.add('Images and embedded attachments are omitted.');
      return '';
    })
    .replace(/\[\[([^\]]+)\]\]/g, (_, target: string) => {
      const parts = target.split('|');
      return parts[parts.length - 1] ?? target;
    });
}

function inlineText(token: Token, notices: Set<string>): {text: string; bold: boolean; italic: boolean} {
  let text = '';
  let strongDepth = 0;
  let emphasisDepth = 0;
  const runs: {text: string; bold: boolean; italic: boolean}[] = [];
  for (const child of token.children ?? []) {
    switch (child.type) {
      case 'strong_open': strongDepth++; break;
      case 'strong_close': strongDepth--; break;
      case 'em_open': emphasisDepth++; break;
      case 'em_close': emphasisDepth--; break;
      case 'image': notices.add('Images and embedded attachments are omitted.'); break;
      case 'softbreak': text += ' '; break;
      case 'hardbreak': text += '\n'; break;
      case 'text':
      case 'code_inline': {
        text += child.content;
        if (child.content.trim()) {
          runs.push({text: child.content, bold: strongDepth > 0, italic: emphasisDepth > 0});
        }
        break;
      }
    }
  }
  const bold = runs.length > 0 && runs.every(run => run.bold);
  const italic = runs.length > 0 && runs.every(run => run.italic);
  if (runs.some(run => run.bold) && !bold || runs.some(run => run.italic) && !italic) {
    notices.add('Mixed inline bold and italic are simplified; text boxes use one style per block.');
  }
  return {text: text.trim(), bold, italic};
}

export function parseMarkdown(input: string, sourcePath = ''): MarkdownDocument {
  const notices = new Set<string>();
  // Leave blank lines in place so source ranges still refer to the original file.
  let source = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  source = source.replace(/^---\s*\n[\s\S]*?\n(?:---|\.\.\.)\s*(?:\n|$)/, frontmatter =>
    frontmatter.replace(/[^\n]/g, ''));
  source = readableObsidian(source, notices);
  const tokens = parser.parse(source, {});
  const blocks: ContentBlock[] = [];
  const lists: {ordered: boolean; next: number}[] = [];
  let itemPrefix = '';
  let inItem = false;
  let quoteDepth = 0;
  let headingLevel = 0;
  let table = false;
  let tableCells: string[] = [];
  let range: [number, number] = [0, 0];

  function add(text: string, kind: ContentBlock['kind'], bold = false, italic = false) {
    if (!text.trim()) {return;}
    blocks.push({id: `b${blocks.length}`, kind, text, sourceRange: range,
      level: kind === 'heading' ? headingLevel : 0, indent: Math.max(0, lists.length - 1),
      bold: bold || kind === 'heading', italic: italic || kind === 'quote'});
  }

  for (const token of tokens) {
    if (token.map) {range = [token.map[0], token.map[1]];}
    switch (token.type) {
      case 'heading_open': headingLevel = Number(token.tag.slice(1)); break;
      case 'heading_close': headingLevel = 0; break;
      case 'blockquote_open': quoteDepth++; break;
      case 'blockquote_close': quoteDepth--; break;
      case 'bullet_list_open': lists.push({ordered: false, next: 1}); break;
      case 'ordered_list_open': lists.push({ordered: true, next: Number(token.attrGet('start') ?? 1)}); break;
      case 'bullet_list_close':
      case 'ordered_list_close': lists.pop(); break;
      case 'list_item_open': {
        const list = lists[lists.length - 1];
        itemPrefix = list?.ordered ? `${list.next++}. ` : '• ';
        inItem = true;
        break;
      }
      case 'list_item_close': inItem = false; itemPrefix = ''; break;
      case 'table_open':
        table = true;
        notices.add('Tables are imported as plain text rows.');
        break;
      case 'table_close': table = false; break;
      case 'tr_open': tableCells = []; break;
      case 'tr_close': add(tableCells.join(' | '), 'table'); break;
      case 'inline': {
        const formatted = inlineText(token, notices);
        if (table) {tableCells.push(formatted.text); break;}
        let text = formatted.text;
        if (inItem && itemPrefix) {
          const task = text.match(/^\[([ xX])\]\s*/);
          if (task) {text = (task[1]?.toLowerCase() === 'x' ? '☑ ' : '☐ ') + text.slice(task[0].length);}
          else {text = itemPrefix + text;}
          itemPrefix = '';
        }
        add(text, headingLevel ? 'heading' : inItem || lists.length ? 'list' : quoteDepth ? 'quote' : 'paragraph',
          formatted.bold, formatted.italic);
        break;
      }
      case 'fence':
      case 'code_block': add(token.content.replace(/\n$/, ''), 'code'); break;
    }
  }
  return {sourcePath, blocks, notices: [...notices]};
}

export function sectionBlockIds(document: MarkdownDocument, headingId: string): string[] {
  const start = document.blocks.findIndex(block => block.id === headingId);
  const heading = document.blocks[start];
  if (!heading || heading.kind !== 'heading') {return [];}
  let end = start + 1;
  while (end < document.blocks.length) {
    const block = document.blocks[end];
    if (block?.kind === 'heading' && block.level <= heading.level) {break;}
    end++;
  }
  return document.blocks.slice(start, end).map(block => block.id);
}

export function selectedBlocks(document: MarkdownDocument, selection: ImportSelection): ContentBlock[] {
  return document.blocks.filter(block => selection.has(block.id));
}
