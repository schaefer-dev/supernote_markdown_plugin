import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';
import {parseMarkdown, sectionBlockIds, selectedBlocks} from './src/core/markdown';
import {planImport} from './src/core/layout';
import {Importer, ImportFailure} from './src/core/importer';
import type {ImportJournal, ImportPlan, MarkdownDocument, NoteContext, Rect, TextPreset} from './src/core/types';
import {bridge} from './src/platform/bridge';
import {DeviceAdapter} from './src/platform/supernote';
import {PagePreview} from './src/ui/PagePreview';

function Button({label, onPress, disabled = false, active = false}: {
  label: string; onPress: () => void; disabled?: boolean; active?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{disabled, selected: active}}
    disabled={disabled} onPress={onPress} style={[styles.button, active && styles.active, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, active && styles.activeText]}>{label}</Text>
  </Pressable>;
}

export default function App() {
  const device = useRef(new DeviceAdapter()).current;
  const importer = useRef(new Importer(device)).current;
  const operation = useRef(false);
  const sessionLoading = useRef(false);
  const [context, setContext] = useState<NoteContext | null>(null);
  const [document, setDocument] = useState<MarkdownDocument | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'content' | 'placement'>('content');
  const [mode, setMode] = useState<ImportPlan['mode']>('new-pages');
  const [preset, setPreset] = useState<TextPreset>('Normal');
  const [area, setArea] = useState<Rect>();
  const [background, setBackground] = useState<string>();
  const [fontPath, setFontPath] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState<ImportJournal | null>(null);
  const [result, setResult] = useState<ImportJournal | null>(null);

  const openSession = useCallback(async () => {
    if (operation.current || sessionLoading.current) {return;}
    sessionLoading.current = true;
    setBusy(true); setError(''); setStatus('Opening notebook…');
    setContext(null); setDocument(null); setSelection(new Set()); setStep('content');
    setPlan(null); setArea(undefined); setBackground(undefined); setResult(null); setRecovery(null);
    setMode('new-pages'); setPreviewPage(0);
    try {
      await device.initialize();
      await device.ensurePermission('READ');
      setContext(await device.context());
      setFontPath(await bridge().resolveFont());
      const previous = await device.lastJournal();
      if (previous && previous.status !== 'complete') {setRecovery(previous);}
    } catch (e) {setError(e instanceof Error ? e.message : String(e));}
    finally {setBusy(false); setStatus(''); sessionLoading.current = false;}
  }, [device]);

  useEffect(() => {
    void openSession();
    const listener = PluginManager.registerButtonListener({onButtonPress: event => {
      if (event.id === 100) {void openSession();}
    }});
    return () => listener.remove();
  }, [openSession]);

  async function work(action: () => Promise<void>) {
    if (operation.current || sessionLoading.current) {return;}
    operation.current = true; setBusy(true); setError('');
    try {await action();}
    catch (e) {setError(e instanceof Error ? e.message : String(e));}
    finally {operation.current = false; setBusy(false); setStatus('');}
  }

  function toggle(ids: string[]) {
    setSelection(previous => {
      const next = new Set(previous);
      const remove = ids.every(id => next.has(id));
      ids.forEach(id => remove ? next.delete(id) : next.add(id));
      return next;
    });
    setPlan(null);
  }

  async function selectFile() {
    await work(async () => {
      const file = await device.selectMarkdown();
      if (!file) {return;}
      const parsed = parseMarkdown(file.text, file.path);
      if (!parsed.blocks.length) {throw new Error('This file has no importable text. Choose another Markdown file.');}
      setDocument(parsed); setSelection(new Set()); setPlan(null);
    });
  }

  async function changeMode(next: ImportPlan['mode']) {
    setMode(next); setPlan(null);
    if (next === 'current-area' && !background && context) {
      await work(async () => {setStatus('Preparing page preview…'); setBackground(await device.preview(context));});
    }
  }

  async function prepare() {
    await work(async () => {
      if (!context || !document) {return;}
      setStatus('Measuring text…');
      const prepared = await planImport({context, sourcePath: document.sourcePath, mode, area, preset, fontPath,
        blocks: selectedBlocks(document, selection), measure: (text, width, style) => bridge().measureText(text, width, style)});
      setPlan(prepared); setPreviewPage(0);
    });
  }

  async function insert() {
    await work(async () => {
      if (!plan) {return;}
      try {setResult(await importer.run(plan, setStatus));}
      catch (e) {
        if (e instanceof ImportFailure && e.journal) {setResult(e.journal); setPlan(null);}
        throw e;
      }
    });
  }

  const returnToNote = () => {if (!busy) {PluginManager.closePluginView();}};
  const count = selection.size;
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Text style={styles.title}>Markdown Import</Text>
      <Button label="Close" onPress={returnToNote} disabled={busy} />
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.caption}>Experimental · editable native text · simplified formatting</Text>
      {context && <Text style={styles.subtitle}>{context.path.split('/').pop()} · page {context.page + 1}</Text>}
      {busy && <View style={styles.row}><ActivityIndicator color="#000" /><Text style={styles.message}>{status || 'Working…'}</Text></View>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!context && !busy && <Button label="Reopen notebook context" onPress={() => void openSession()} />}

      {recovery && !result && <View style={styles.notice}>
        <Text style={styles.sectionTitle}>Previous import needs review</Text>
        <Text style={styles.message}>The last import did not finish. {recovery.insertedBoxes} text boxes were confirmed inserted; {recovery.verifiedPages.length} pages were verified.</Text>
        <Text selectable style={styles.message}>Recovery copy: {recovery.backupPath}</Text>
        {!!recovery.pendingOperation && <Text style={styles.message}>Last pending step: {recovery.pendingOperation}. It may already have been applied.</Text>}
        <Text style={styles.message}>Review the notebook before importing again. Restore from the copy only if needed; it predates the import.</Text>
        <Button label="I reviewed the notebook" onPress={() => setRecovery(null)} disabled={busy} />
      </View>}

      {result && <View style={styles.notice}>
        <Text style={styles.sectionTitle}>{result.status === 'complete' ? 'Import complete' : 'Import stopped'}</Text>
        <Text style={styles.message}>{result.insertedBoxes} text boxes inserted · {result.verifiedPages.length} pages verified</Text>
        <Text selectable style={styles.message}>Recovery copy: {result.backupPath}</Text>
        {result.status !== 'complete' && <Text style={styles.message}>Some content may already be present. Review it before starting another import.</Text>}
        <Button label="Return to notebook" onPress={returnToNote} disabled={busy} />
      </View>}

      {context && !recovery && !result && step === 'content' && <>
        <Button label={document ? 'Choose another Markdown file' : 'Choose Markdown file'} onPress={() => void selectFile()} disabled={busy} />
        {document && <>
          <Text selectable style={styles.source}>{document.sourcePath}</Text>
          {!!document.notices.length && <View style={styles.notice}>{document.notices.map(notice => <Text key={notice} style={styles.message}>{notice}</Text>)}</View>}
          <View style={styles.row}>
            <Button label="Select all" onPress={() => {setSelection(new Set(document.blocks.map(block => block.id))); setPlan(null);}} disabled={busy} />
            <Button label="Clear" onPress={() => {setSelection(new Set()); setPlan(null);}} disabled={busy} />
          </View>
          <Text style={styles.caption}>Tap a block to select it. “Whole section” includes its heading and subsections.</Text>
          {document.blocks.map(block => <View key={block.id} style={styles.block}>
            <Pressable disabled={busy} accessibilityRole="checkbox" accessibilityState={{checked: selection.has(block.id)}}
              onPress={() => toggle([block.id])} style={[styles.blockChoice, {paddingLeft: 12 + block.indent * 12}]}>
              <Text style={styles.checkbox}>{selection.has(block.id) ? '☑' : '☐'}</Text>
              <Text style={[styles.blockText, block.bold && styles.bold, block.italic && styles.italic]}>{block.text}</Text>
            </Pressable>
            {block.kind === 'heading' && <Button label="Whole section" onPress={() => toggle(sectionBlockIds(document, block.id))} disabled={busy} />}
          </View>)}
          <Button label={`Continue · ${count} blocks`} onPress={() => setStep('placement')} disabled={busy || !count} />
        </>}
      </>}

      {context && !recovery && !result && step === 'placement' && <>
        <Button label="Back to selection" onPress={() => {setStep('content'); setPlan(null);}} disabled={busy} />
        <Text style={styles.sectionTitle}>Placement</Text>
        <View style={styles.row}>
          <Button label="New pages after this page" active={mode === 'new-pages'} onPress={() => void changeMode('new-pages')} disabled={busy} />
          <Button label="Area on this page" active={mode === 'current-area'} onPress={() => void changeMode('current-area')} disabled={busy} />
        </View>
        <Text style={styles.sectionTitle}>Text size</Text>
        <View style={styles.row}>{(['Small', 'Normal', 'Large'] as TextPreset[]).map(size =>
          <Button key={size} label={size} active={preset === size} onPress={() => {setPreset(size); setPlan(null);}} disabled={busy} />)}</View>
        {mode === 'current-area' && <>
          <Text style={styles.message}>Draw a rectangle on the page preview. Drag again to adjust it. Choose free space; existing handwriting stays in place.</Text>
          {!background && <Button label="Load page preview" onPress={() => void changeMode('current-area')} disabled={busy} />}
        </>}
        {(mode === 'new-pages' || background) && <PagePreview size={context}
          background={mode === 'current-area' ? background : undefined}
          boxes={plan?.pages[previewPage]} area={mode === 'current-area' ? area : undefined}
          disabled={busy} onArea={mode === 'current-area' ? rect => {setArea(rect); setPlan(null);} : undefined} />}
        {plan && <>
          <Text style={styles.message}>{plan.pages.length} {mode === 'new-pages' ? 'new pages' : 'existing page'} · {plan.pages.reduce((sum, page) => sum + page.length, 0)} editable text boxes</Text>
          {plan.pages.length > 1 && <View style={styles.row}>
            <Button label="Previous preview" disabled={busy || previewPage === 0} onPress={() => setPreviewPage(value => value - 1)} />
            <Text style={styles.message}>{previewPage + 1}/{plan.pages.length}</Text>
            <Button label="Next preview" disabled={busy || previewPage === plan.pages.length - 1} onPress={() => setPreviewPage(value => value + 1)} />
          </View>}
          <Text style={styles.caption}>The preview approximates native rendering. A verified recovery copy is created before insertion.</Text>
        </>}
        <View style={styles.row}>
          <Button label="Prepare preview" onPress={() => void prepare()} disabled={busy || mode === 'current-area' && (!area || !background)} />
          <Button label="Insert" onPress={() => void insert()} disabled={busy || !plan} active={!!plan} />
        </View>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#fff'},
  header: {padding: 20, borderBottomWidth: 2, borderColor: '#000', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  title: {fontSize: 28, fontWeight: 'bold', color: '#000'},
  content: {padding: 20, paddingBottom: 48},
  caption: {fontSize: 16, color: '#444', marginBottom: 12},
  subtitle: {fontSize: 19, fontWeight: '600', color: '#000', marginBottom: 16},
  sectionTitle: {fontSize: 21, fontWeight: 'bold', color: '#000', marginVertical: 12},
  row: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginVertical: 8},
  button: {borderWidth: 1.5, borderColor: '#000', borderRadius: 4, paddingVertical: 13, paddingHorizontal: 16, marginVertical: 4, backgroundColor: '#fff'},
  buttonText: {fontSize: 18, color: '#000', fontWeight: '600'},
  active: {backgroundColor: '#000'}, activeText: {color: '#fff'}, disabled: {opacity: 0.4},
  message: {fontSize: 17, lineHeight: 24, color: '#000', marginVertical: 5, flexShrink: 1},
  error: {borderWidth: 2, borderColor: '#000', padding: 14, fontSize: 18, color: '#000', marginVertical: 12},
  notice: {backgroundColor: '#eee', borderWidth: 1, borderColor: '#777', padding: 14, marginVertical: 12},
  source: {fontSize: 16, color: '#333', marginVertical: 12},
  block: {borderBottomWidth: 1, borderColor: '#bbb', paddingVertical: 8},
  blockChoice: {flexDirection: 'row', alignItems: 'flex-start', padding: 12},
  checkbox: {fontSize: 25, color: '#000', marginRight: 12},
  blockText: {fontSize: 19, lineHeight: 27, color: '#000', flex: 1},
  bold: {fontWeight: 'bold'}, italic: {fontStyle: 'italic'},
});
