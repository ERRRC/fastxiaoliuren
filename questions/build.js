const fs = require('fs');
const path = require('path');

const dir = __dirname;
// 章节教学顺序：超简易 → 六宫 → 宫位 → 口诀 → 组合课断 → 辨析进阶 → 历法 → 通识
// （起课入门/现代情景 已删，分片备份在 .workbuddy-backup/questions-removed-2026-09-01/）
const shards = [
  'ch_easy.json',   // ea 超简易入门（含自起课入门迁入的 3 道起课锚点题）
  '_c1.json',       // c1 六宫入门
  '_c2.json',       // c2 宫位属性
  'ch_kj6.json',    // kj 口诀白话
  '_c3.json',       // c3 口诀白话
  '_c10_apply.json',// sa 断事应用（L2 情景应用，承接已删的现代情景）
  '_c8_combos.json',// cb 组合课断（溯源 combos.json）
  '_c9_discrim.json',// dc 辨析进阶
  'ch_time.json',   // c0 时辰历法
  'ch_common.json', // c6 占卜通识
];
const PREFIX_CHAPTER = {
  ea: '超简易入门', c1: '六宫入门', c2: '宫位属性',
  kj: '口诀白话', c3: '口诀白话', sa: '断事应用', cb: '组合课断', dc: '辨析进阶',
  c0: '时辰历法', c6: '占卜通识',
};
const SOURCE_WHITELIST = [
  '诸葛马前课通行本', '时辰通行对照', '生肖通行配属', '术数通识', '八卦取象歌', '《易·系辞》',
  '日加时诀·通行本', '三才合论·通行教法',
];
const all = [];
const errors = [];
const warns = [];

for (const f of shards) {
  const arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (!Array.isArray(arr)) errors.push(`${f}: 顶层数组`);
  all.push(...arr);
}

// (a) 总题数
console.log(`总题数: ${all.length}`);
if (all.length < 260) errors.push(`总题数 ${all.length} < 260`);

const combos = JSON.parse(fs.readFileSync(path.join(dir, 'combos.json'), 'utf8'));
const pairKeys = new Set();
for (const pr of combos.pairs) { pairKeys.add(pr.a + '+' + pr.b); }

const ids = new Set();
const palaceNames = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'];
const palaceCount = Object.fromEntries(palaceNames.map(p => [p, 0]));
const posCount = { 0: 0, 1: 0, 2: 0, 3: 0 }; // single 题正确答案位置
const chapterCount = {};
const typeCount = {};
const diffCount = { 1: 0, 2: 0, 3: 0 };

for (const q of all) {
  const fid = `${q.id}`;
  if (ids.has(q.id)) errors.push(`${fid}: id 重复`);
  ids.add(q.id);
  const prefix = fid.split('-')[0];
  if (!/^(ea|sa|c0|c1|c2|c3|c6|kj|cb|dc)-\d{4}$/.test(fid)) errors.push(`${fid}: id 格式`);
  const chapExpected = PREFIX_CHAPTER[prefix];
  if (q.chapter !== chapExpected) errors.push(`${fid}: chapter「${q.chapter}」与前缀不符（应为「${chapExpected}」）`);
  if (!['single', 'judge', 'multi'].includes(q.type)) errors.push(`${fid}: type「${q.type}」`);
  if (!SOURCE_WHITELIST.includes(q.source)) errors.push(`${fid}: source「${q.source}」不在白名单`);
  if (!q.explanation || q.explanation.length < 8) errors.push(`${fid}: explanation 缺失或过短`);
  if (![1, 2, 3].includes(q.difficulty)) errors.push(`${fid}: difficulty`);
  if (!Array.isArray(q.answer) || q.answer.length === 0) errors.push(`${fid}: answer`);

  // 组合课断题溯源检查：解析必须指向 combos.json 中真实存在的组合/格局
  if (prefix === 'cb') {
    const m = q.explanation.match(/SOURCE:combos\.json#pairs\[([^\]]+)\]/);
    const pm = q.explanation.match(/SOURCE:combos\.json#patterns\[([^\]]+)\]/);
    if (!m && !pm && !/SOURCE:palaces|SOURCE:combos\.json#sancai/.test(q.explanation)) {
      errors.push(`${fid}: cb 题解析缺少 combos.json/palaces 溯源标记`);
    }
    if (m && !pairKeys.has(m[1])) errors.push(`${fid}: 溯源组合「${m[1]}」在 combos.json 中不存在`);
    if (pm) {
      const pn = pm[1].split('][')[0];
      if (!combos.patterns.some(p => p.name === pn)) errors.push(`${fid}: 溯源格局「${pn}」在 combos.json 中不存在`);
    }
  }

  if (q.type === 'judge') {
    if (JSON.stringify(q.options) !== JSON.stringify(['正确', '错误'])) errors.push(`${fid}: judge options 必须为 ["正确","错误"]`);
    if (q.answer.length !== 1 || ![0, 1].includes(q.answer[0])) errors.push(`${fid}: judge answer`);
  } else {
    if (q.options.length !== 4) errors.push(`${fid}: options 长度 ${q.options.length} ≠ 4`);
    if (new Set(q.options).size !== q.options.length) errors.push(`${fid}: options 有重复项`);
    for (const a of q.answer) if (!Number.isInteger(a) || a < 0 || a >= q.options.length) errors.push(`${fid}: answer 下标越界 ${a}`);
    if (q.type === 'multi' && q.answer.length < 2) errors.push(`${fid}: multi 答案应至少 2 项`);
    if (q.type === 'single' && q.answer.length !== 1) errors.push(`${fid}: single 答案应 1 项`);
    if (q.type === 'single') posCount[q.answer[0]]++;
  }

  chapterCount[q.chapter] = (chapterCount[q.chapter] || 0) + 1;
  typeCount[q.type] = (typeCount[q.type] || 0) + 1;
  diffCount[q.difficulty]++;
  for (const p of palaceNames) if ((q.stem + q.explanation).includes(p)) palaceCount[p]++;
}

// 章节出现顺序必须与教学顺序一致
const chapterOrder = [];
for (const q of all) if (!chapterOrder.includes(q.chapter)) chapterOrder.push(q.chapter);
const teachOrder = ['超简易入门', '六宫入门', '宫位属性', '口诀白话', '断事应用', '组合课断', '辨析进阶', '时辰历法', '占卜通识'];
if (JSON.stringify(chapterOrder) !== JSON.stringify(teachOrder)) {
  errors.push(`章节顺序不符教学流: ${chapterOrder.join(' → ')}`);
}

console.log('章节分布:', chapterCount);
console.log('题型分布:', typeCount);
console.log('难度分布:', diffCount);
console.log('single 正确答案位置分布:', posCount);
console.log('六宫提及次数(题干+解析):', palaceCount);

const total1 = Object.values(posCount).reduce((a, b) => a + b, 0);
for (const [pos, n] of Object.entries(posCount)) {
  if (n / total1 > 0.35 || n / total1 < 0.15) warns.push(`答案位置 ${pos} 占比 ${Math.round(n / total1 * 100)}% 偏离 25%（归一化前，写出时会轮转摊平）`);
}
for (const p of palaceNames) {
  const min = Math.min(...palaceNames.map(x => palaceCount[x]));
  if (palaceCount[p] / min > 1.8) warns.push(`六宫覆盖不均: ${p} 提及 ${palaceCount[p]} 次, 最少 ${min} 次`);
}

if (errors.length) { console.log('\n[ERRORS]'); errors.forEach(e => console.log(' -', e)); }
if (warns.length) { console.log('\n[WARNINGS]'); warns.forEach(w => console.log(' -', w)); }
if (errors.length) { console.log('\n校验未通过，未写出 questions.json'); process.exit(1); }

// 剥离 SOURCE 溯源标记（分片内保留供校验，不进 questions.json/包内展示）
// 标记恒在解析末尾（build 校验已保证格式），整段剥到行尾。
let stripped = 0;
for (const q of all) {
  if (/ ?SOURCE:.*$/.test(q.explanation)) {
    q.explanation = q.explanation.replace(/ ?SOURCE:.*$/, '').trim();
    stripped++;
  }
}
console.log(`已剥离 SOURCE 标记: ${stripped} 题`);

// 答案位置归一化：把 single 题正确选项按 0→1→2→3 轮转摊平
// （旧题库 54% 的正确答案在 A 位，闭眼选 A 的正确率虚高）。循环轮转，不改变选项相对顺序。
// 跳过解析里用「A/B/C/D」指代选项的题——轮转会让字母指代失效；这些题书写时已手动摊平。
const LETTER_REF = /选\s*[A-D]、?[A-D]?|（?[A-D]）?\s*(是|为|对|错|把|忽略了|无中生有|明显错误|说反了|张冠李戴)/;
let rot = 0;
for (const q of all) {
  if (q.type !== 'single') continue;
  if (LETTER_REF.test(q.explanation)) continue;
  const target = rot % 4; rot++;
  const cur = q.answer[0];
  if (cur !== target) {
    const off = (cur - target + 4) % 4;
    q.options = q.options.map((_, i) => q.options[(i + off) % 4]);
    q.answer = [target];
  }
}
const rotDist = { 0: 0, 1: 0, 2: 0, 3: 0 };
all.forEach(q => { if (q.type === 'single') rotDist[q.answer[0]]++; });
console.log('归一化后答案位置分布:', rotDist);

// 合并写出（顶层为数组）
fs.writeFileSync(path.join(dir, 'questions.json'), JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`\n✓ 已写出 questions.json（${all.length} 题）`);

// 生成根目录 questions.js（运行时包装，供 sync-www.js 拷入 www/）
const runtime = "(function(root,f){if(typeof module!=='undefined'&&module.exports){module.exports=f();}else{root.QUESTIONS=f();}})(typeof self!=='undefined'?self:this,function(){return " + JSON.stringify(all) + ";});\n";
fs.writeFileSync(path.join(dir, '..', 'questions.js'), runtime, 'utf8');
console.log('✓ 已写出 ../questions.js（运行时包装）');
