jest.mock('sn-plugin-lib', () => ({
  PluginManager: {hasPermission: jest.fn(), requestPermission: jest.fn(), getPluginDirPath: jest.fn()},
  PluginCommAPI: {getCurrentFilePath: jest.fn(), getCurrentPageNum: jest.fn(), reloadFile: jest.fn(), jumpToPage: jest.fn()},
  PluginFileAPI: {getPageSize: jest.fn(), getElements: jest.fn(), insertNotePage: jest.fn()},
  PluginNoteAPI: {saveCurrentNote: jest.fn(), insertText: jest.fn()},
  FileUtils: {getExportPath: jest.fn(), exists: jest.fn(), makeDir: jest.fn(), copyFile: jest.fn(), getFileMD5: jest.fn()},
  RattaFileSelector: {selectFile: jest.fn()},
}));
jest.mock('../src/platform/bridge', () => ({bridge: () => ({readPrivate: jest.fn(async () => null)})}));
import {FileUtils, PluginCommAPI, PluginFileAPI, PluginManager, PluginNoteAPI, RattaFileSelector} from 'sn-plugin-lib';
import {DeviceAdapter} from '../src/platform/supernote';

beforeEach(() => jest.resetAllMocks());
it('uses existing permission without opening another prompt', async () => {
  (PluginManager.hasPermission as jest.Mock).mockResolvedValue(1);
  await new DeviceAdapter().ensurePermission('READ');
  expect(PluginManager.requestPermission).not.toHaveBeenCalled();
});
it.each([1, 2])('accepts one-session or persistent permission grant %s', async status => {
  (PluginManager.hasPermission as jest.Mock).mockResolvedValue(0);
  (PluginManager.requestPermission as jest.Mock).mockResolvedValue(status);
  await expect(new DeviceAdapter().ensurePermission('WRITE')).resolves.toBeUndefined();
});
it.each([0, -1])('handles permission refusal/cancellation %s', async status => {
  (PluginManager.hasPermission as jest.Mock).mockResolvedValue(0);
  (PluginManager.requestPermission as jest.Mock).mockResolvedValue(status);
  await expect(new DeviceAdapter().ensurePermission('READ')).rejects.toThrow('Settings');
});
it('rejects locked or non-notebook contexts', async () => {
  (PluginCommAPI.getCurrentFilePath as jest.Mock).mockResolvedValue({success: false, error: {code: 1217}});
  await expect(new DeviceAdapter().context()).rejects.toThrow('Unlock');
  (PluginCommAPI.getCurrentFilePath as jest.Mock).mockResolvedValue({success: true, result: '/Document/test.pdf'});
  (PluginCommAPI.getCurrentPageNum as jest.Mock).mockResolvedValue({success: true, result: 0});
  await expect(new DeviceAdapter().context()).rejects.toThrow('native notebook');
});
it('reads the actual SDK page dimensions, including page zero', async () => {
  (PluginCommAPI.getCurrentFilePath as jest.Mock).mockResolvedValue({success: true, result: '/Note/test.note'});
  (PluginCommAPI.getCurrentPageNum as jest.Mock).mockResolvedValue({success: true, result: 0});
  (PluginFileAPI.getPageSize as jest.Mock).mockResolvedValue({success: true, result: {width: 1400, height: 1000}});
  expect(await new DeviceAdapter().context()).toEqual({path: '/Note/test.note', page: 0, width: 1400, height: 1000});
});
it('passes editable native text flags and treats false results as failure', async () => {
  const device = new DeviceAdapter();
  const box = {blockId: 'b0', text: 'Native words', rect: {left: 10, top: 10, right: 100, bottom: 100},
    fontSize: 25, fontPath: '/system/fonts/Roboto-Regular.ttf', bold: true, italic: false};
  (PluginNoteAPI.insertText as jest.Mock).mockResolvedValue({success: true, result: false});
  await expect(device.insertText(box)).rejects.toThrow('refused');
  expect(PluginNoteAPI.insertText).toHaveBeenCalledWith(expect.objectContaining({textEditable: 0, textBold: 1,
    textContentFull: 'Native words', fontPath: box.fontPath, textRect: box.rect}));
});
it('verifies recovery copies against the saved original', async () => {
  (FileUtils.getExportPath as jest.Mock).mockResolvedValue('/EXPORT');
  (FileUtils.exists as jest.Mock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  (FileUtils.copyFile as jest.Mock).mockResolvedValue(true);
  (FileUtils.getFileMD5 as jest.Mock).mockResolvedValueOnce('original').mockResolvedValueOnce('wrong');
  await expect(new DeviceAdapter().backup('/Note/test.note', 'id')).rejects.toThrow('verification failed');
});
it('releases SDK element cache handles after reading saved data', async () => {
  const recycle = jest.fn(async () => {});
  (PluginFileAPI.getElements as jest.Mock).mockResolvedValue({success: true, result: [
    {numInPage: 8, type: 500, textBox: {textContentFull: 'Text', textEditable: 0}, recycle},
  ]});
  expect(await new DeviceAdapter().readElements('/Note/test.note', 0)).toEqual([
    {number: 8, type: 500, text: 'Text', editable: 0, rect: undefined},
  ]);
  expect(recycle).toHaveBeenCalledTimes(1);
});
it('handles file-picker cancellation without reading a file', async () => {
  (PluginManager.hasPermission as jest.Mock).mockResolvedValue(1);
  (RattaFileSelector.selectFile as jest.Mock).mockResolvedValue(null);
  await expect(new DeviceAdapter().selectMarkdown()).resolves.toBeNull();
});
