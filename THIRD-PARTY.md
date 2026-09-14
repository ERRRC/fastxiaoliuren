# 第三方组件与内容来源

本项目的代码以 [MIT 许可证](LICENSE) 开源；其中包含的第三方组件与内容来源如下。

## 代码依赖

| 组件 | 位置 | 许可证 | 说明 |
|---|---|---|---|
| [solarlunar](https://github.com/isee15/Lunar-Solar-Calendar-Converter) 2.0.7 | `vendor/solarlunar.min.js` | MIT | 公历 ↔ 农历转换。已内联进仓库，运行时不联网 |
| [Capacitor](https://capacitorjs.com/) 6 | `android/`、`package.json` | MIT | Android 壳（原生容器） |
| AndroidX（appcompat / coordinatorlayout / core-splashscreen 等） | `android/app/build.gradle` | Apache-2.0 | Android 官方支持库 |
| [jsdom](https://github.com/jsdom/jsdom) | `package.json` devDependencies | MIT | 仅用于界面冒烟测试，不进入应用 |
| [sharp](https://github.com/lovell/sharp) | `package.json` devDependencies | Apache-2.0 | 仅用于生成应用图标 |

## 内容来源

- **传统口诀与断语**：摘自小六壬（诸葛马前课）通行本等民俗文献，以及《易·系辞》"八卦取象歌"等公有领域典籍。
  断语在 `palaces.json` / `combos.json` 中有明确出处字段，可在应用内逐条核对。
- **题库（269 题）**：由本项目作者依据上述文献整理编写，未收录他人享有著作权的现代出版物内容。
- **掌图底图**：`assets/palm.webp`（及其源图 `assets-src/`）为本项目自制素材。

## 使用提醒

本项目为传统民俗文化的学习与查阅工具，所有内容仅供文化研究与娱乐参考，
不构成医疗、投资、法律或任何其他决策建议（详见 [README 免责声明](README.md#免责声明)）。
