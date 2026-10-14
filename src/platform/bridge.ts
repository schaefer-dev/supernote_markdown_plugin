import {NativeModules} from 'react-native';
import type {MeasuredLine, TextStyle} from '../core/types';

interface MarkdownBridge {
  configureStorageRoot(path: string): Promise<void>;
  readMarkdown(path: string): Promise<string>;
  readPrivate(name: string): Promise<string | null>;
  writePrivate(name: string, content: string): Promise<void>;
  resolveFont(): Promise<string>;
  measureText(text: string, width: number, style: TextStyle): Promise<MeasuredLine[]>;
}

export function bridge(): MarkdownBridge {
  const module = NativeModules.MarkdownBridge as MarkdownBridge | undefined;
  if (!module) {throw new Error('The plugin native package is missing. Install the complete .snplg build.');}
  return module;
}
