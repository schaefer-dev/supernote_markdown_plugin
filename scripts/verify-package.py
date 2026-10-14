#!/usr/bin/env python3
"""Fail if the installer is missing its custom bridge, manifest, bundle or native package."""
import io
import json
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as package:
    names = set(package.namelist())
    config = json.loads(package.read('PluginConfig.json'))
    assert config['pluginKey'] == 'supernote-markdown-plugin', 'Wrong React Native registry key'
    assert config['pluginID'] == 'snmdschaefer00001', 'Persistent plugin ID changed'
    assert config['versionName'] == '0.1.0', 'Manifest/package version mismatch'
    assert 'supernote-markdown-plugin.bundle' in names, 'JavaScript bundle missing'
    assert config.get('nativeCodePackage') == '/app.npk', 'Native package missing from manifest'
    assert 'dev.schaefer.supernotemarkdown.MarkdownBridgePackage' in config.get('reactPackages', []), 'Bridge registration missing'
    assert set(config['uses-permissions']) == {'plugin.permission.FILE:READ', 'plugin.permission.FILE:WRITE'}, 'Unexpected permissions'
    assert config['iconPath'].lstrip('/') in names, 'Icon missing'
    assert package.testzip() is None, 'Installer is corrupt'
    with zipfile.ZipFile(io.BytesIO(package.read('app.npk'))) as native:
        dex = b''.join(native.read(name) for name in native.namelist() if name.endswith('.dex'))
        assert b'MarkdownBridgeModule' in dex, 'Bridge implementation missing'
        assert b'MarkdownBridgePackage' in dex, 'Bridge package missing'
print('Installer verified: JavaScript bundle, Android bridge, manifest and permissions.')
