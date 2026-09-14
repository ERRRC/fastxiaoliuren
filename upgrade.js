/*
 * 题库 v2 改造脚本：node upgrade.js
 * 1) 章节改名  2) 题干去文言腔  3) 解析自动补【白话】【现实】
 * 输入 questions.json → 输出 questions_v2.json
 */
'use strict';
const fs = require('fs');
const { PALACES, MODERN_MAP } = require('./palaces.js');

const qs = JSON.parse(fs.readFileSync('./questions/questions.json', 'utf8'));

const CHAPTER_RENAME = {
  六宫基础: '六宫入门',
  宫位属性: '宫位属性',
  断语口诀: '口诀白话',
  情景判断: '现代情景'
};

const TOPIC_KEYS = Object.keys(MODERN_MAP);

function detectPalace(text) {
  let best = null, bestPos = 1e9;
  PALACES.forEach(p => {
    const i = text.indexOf(p.name);
    if (i >= 0 && i < bestPos) { best = p; bestPos = i; }
  });
  return best;
}
function detectTopic(text) {
  for (const k of TOPIC_KEYS) if (text.includes(k)) return k;
  return null;
}

function upgradeStem(stem) {
  return stem
    .replace(/按传统断语/g, '按传统口诀的说法')
    .replace(/传统断语/g, '传统口诀的说法')
    .replace(/落(大安|留连|速喜|赤口|小吉|空亡)(?![宫])/g, '落在$1宫')
    .replace(/(大安|留连|速喜|赤口|小吉|空亡)诀/g, '$1口诀')
    .replace(/句诀/g, '口诀')
    .replace(/断语/g, '口诀')
    .replace(/起课/g, '掐算');
}

function augmentExplanation(q) {
  const full = q.stem + ' ' + q.options.join(' ') + ' ' + (q.explanation || '');
  const palace = detectPalace(q.stem);
  const topic = detectTopic(full);
  const parts = [];
  if (palace) {
    let line = null;
    // 优先匹配题干里引用的口诀原句
    for (const l of palace.verseLines) {
      if (q.stem.includes(l.line.slice(0, 5))) { line = l; break; }
    }
    if (!line && topic) line = palace.verseLines.find(l => l.topic === topic);
    if (!line) line = palace.verseLines.find(l => l.topic === '总象');
    if (line) parts.push('【白话】' + line.line + '——' + line.plain + '。');
  }
  if (topic) parts.push('【现实】' + topic + '在今天≈' + MODERN_MAP[topic] + '。');
  return parts.length ? (q.explanation || '') + ' ' + parts.join(' ') : (q.explanation || '');
}

let renamed = 0, augmented = 0;
const out = qs.map(q => {
  const nq = Object.assign({}, q);
  if (CHAPTER_RENAME[q.chapter]) { nq.chapter = CHAPTER_RENAME[q.chapter]; renamed++; }
  nq.stem = upgradeStem(q.stem);
  const before = q.explanation || '';
  nq.explanation = augmentExplanation(q);
  if (nq.explanation !== before) augmented++;
  return nq;
});

fs.writeFileSync('./questions/questions_v2.json', JSON.stringify(out, null, 2), 'utf8');
console.log('总数', out.length, '| 章节改名', renamed, '| 解析增强', augmented);
const byCh = {};
out.forEach(q => byCh[q.chapter] = (byCh[q.chapter] || 0) + 1);
console.log(JSON.stringify(byCh));
