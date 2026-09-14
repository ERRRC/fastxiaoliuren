// 从 questions/combos.json 生成运行时文件 combos.js / www/combos.js
// combos.json 是组合课断的唯一源头（与 palaces.js 并列的断语溯源文件），
// 前端要用必须走这里生成，不要手抄——否则两处会漂移。
// 用法：node questions/gen-combos.js
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'combos.json');
const data = JSON.parse(fs.readFileSync(src, 'utf8'));

// 只导出前端真正需要的三个知识层，_readme 是体例说明，不进包
const out = {
  sancai: data.sancai,
  patterns: data.patterns,
  pairs: data.pairs
};

function build() {
  return [
    '/*',
    ' * 组合课断知识层（由 questions/gen-combos.js 自动生成，请勿手改）',
    ' * 唯一源头：questions/combos.json —— 改断语请改 json 后重跑 node questions/gen-combos.js',
    ' * 内容：三才定位（sancai）· 三宫格局（patterns）· 日加时诀 30 组（pairs）',
    ' * 浏览器：window.COMBOS；Node：module.exports',
    ' */',
    '(function (root, factory) {',
    "  if (typeof module !== 'undefined' && module.exports) {",
    '    module.exports = factory();',
    '  } else {',
    '    root.COMBOS = factory();',
    '  }',
    "})(typeof self !== 'undefined' ? self : this, function () {",
    "  'use strict';",
    '  return ' + JSON.stringify(out, null, 2).split('\n').join('\n  ') + ';',
    '});',
    ''
  ].join('\n');
}

const text = build();
const root = path.join(__dirname, '..');
fs.writeFileSync(path.join(root, 'combos.js'), text);
fs.writeFileSync(path.join(root, 'www', 'combos.js'), text);

const sizes = ['sancai', 'patterns', 'pairs']
  .map(k => k + ' ' + out[k].length).join(' / ');
console.log('combos.js 已生成 → 根目录 + www/　（' + sizes + '）');
