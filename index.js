import {AppRegistry, Image} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';
import App from './App';
import {name} from './app.json';

AppRegistry.registerComponent(name, () => App);
PluginManager.init();
PluginManager.registerButton(1, ['NOTE'], {
  id: 100,
  name: 'Import Markdown',
  icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
  showType: 1,
});
