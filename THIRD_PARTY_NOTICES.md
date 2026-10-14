# Third-party notices

The Android scaffold, React Native configuration, default icon and `buildPlugin.sh` originate from `@supernote-plugin/sn-plugin-template` 1.0.13 (MIT). Its license text is reproduced below.

The project uses React 19.0.0, React Native 0.79.2, sn-plugin-lib 0.2.3 and markdown-it 14.3.2, plus their dependencies. Their license notices are distributed in the installed npm packages and Android dependency artifacts. See `package-lock.json` for the full dependency graph. No code is copied from community import plugins.

Local template modifications: project naming, one custom native ReactPackage, arm64-only build, removal of the production Internet permission, and stopping packaging on native-build failure. Compatible CLI 18.0.1 and markdown-it 14.3.2 patch releases replace older scaffold/parser versions. The official packaging script still performs the host-compatible APK trimming.

## sn-plugin-template license

```text
MIT License

Copyright (c) 2018 react-native-community

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
