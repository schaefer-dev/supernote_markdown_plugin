export type Rect = {left: number; top: number; right: number; bottom: number};
export type PageSize = {width: number; height: number};
export type BlockKind = 'heading' | 'paragraph' | 'list' | 'quote' | 'code' | 'table';
export interface ContentBlock {
  id: string;
  kind: BlockKind;
  text: string;
  sourceRange: [number, number];
  level: number;
  indent: number;
  bold: boolean;
  italic: boolean;
}
export interface MarkdownDocument {
  sourcePath: string;
  blocks: ContentBlock[];
  notices: string[];
}
export type ImportSelection = ReadonlySet<string>;
export type TextPreset = 'Small' | 'Normal' | 'Large';
export interface TextStyle {
  fontSize: number;
  fontPath: string;
  bold: boolean;
  italic: boolean;
}
export interface MeasuredLine {text: string; height: number}
export type MeasureText = (text: string, width: number, style: TextStyle) => Promise<MeasuredLine[]>;
export interface PlannedTextBox extends TextStyle {
  blockId: string;
  text: string;
  rect: Rect;
}
export interface NoteContext extends PageSize {path: string; page: number}
export interface ImportPlan {
  context: NoteContext;
  mode: 'new-pages' | 'current-area';
  sourcePath: string;
  pages: PlannedTextBox[][];
}
export interface ImportJournal {
  id: string;
  notePath: string;
  sourcePath: string;
  backupPath: string;
  status: 'prepared' | 'writing' | 'complete' | 'failed';
  createdPages: number[];
  verifiedPages: number[];
  insertedBoxes: number;
  pendingOperation?: string;
  error?: string;
}
