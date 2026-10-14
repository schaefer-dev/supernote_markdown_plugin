# Third-party notices

The Android scaffold, React Native configuration, default icon and `buildPlugin.sh` originate from `@supernote-plugin/sn-plugin-template` 1.0.13 (MIT). Its license text is preserved in `LICENSE`.

The project uses React 19.0.0, React Native 0.79.2, sn-plugin-lib 0.2.3 and markdown-it 14.3.2, plus their dependencies. Their license notices are distributed in the installed npm packages and Android dependency artifacts. See `package-lock.json` for the full dependency graph. No code is copied from community import plugins.

Local template modifications: project naming, one custom native ReactPackage, arm64-only build, removal of the production Internet permission, and stopping packaging on native-build failure. Compatible CLI 18.0.1 and markdown-it 14.3.2 patch releases replace older scaffold/parser versions. The official packaging script still performs the host-compatible APK trimming.
