/*
 * 引擎锚点测试（node test.js）
 * 锚点来源：万年历核对（2026-08-31 = 农历七月十九）；2026-02-17、2025-01-29 为春节（正月初一）
 * 起课锚点：2026-08-31 未时 = 大安/大安/留连（2026-08-31 当日实测核对）
 */
'use strict';
const XLR = require('./engine.js');
const P = require('./palaces.js').PALACES;

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      期望 ${e}\n      实际 ${a}`); }
}

console.log('== 历法锚点 ==');
const r1 = XLR.solar2lunar(2026, 8, 31);
check('2026-08-31 → 七月十九', [r1.month, r1.day, r1.isLeap], [7, 19, false]);
check('2026-02-17 → 正月初一', [XLR.solar2lunar(2026, 2, 17).month, XLR.solar2lunar(2026, 2, 17).day], [1, 1]);
check('2025-01-29 → 正月初一', [XLR.solar2lunar(2025, 1, 29).month, XLR.solar2lunar(2025, 1, 29).day], [1, 1]);

console.log('== 时辰锚点 ==');
check('14点 → 未时(7)', XLR.shichenIndex(14), 7);
check('15点 → 申时(8)', XLR.shichenIndex(15), 8);
check('23点 → 子时(0)', XLR.shichenIndex(23), 0);
check('0点 → 子时(0)', XLR.shichenIndex(0), 0);
check('1点 → 丑时(1)', XLR.shichenIndex(1), 1);

console.log('== 起课锚点 ==');
check('七月十九未时 → 大安/大安/留连', XLR.computePalaces(7, 19, 7), { monthPalace: 0, dayPalace: 0, hourPalace: 1 });
check('三月初五酉时 → 速喜/大安/赤口', XLR.computePalaces(3, 5, 9), { monthPalace: 2, dayPalace: 0, hourPalace: 3 });
check('正月初一子时 → 大安/大安/大安', XLR.computePalaces(1, 1, 0), { monthPalace: 0, dayPalace: 0, hourPalace: 0 });
check('腊月三十亥时 → 空亡/小吉/赤口', XLR.computePalaces(12, 30, 11), { monthPalace: 5, dayPalace: 4, hourPalace: 3 });

console.log('== 全量遍历自检（12月×30日×12时辰 共4320组，无越界）==');
let bad = 0;
for (let m = 1; m <= 12; m++)
  for (let d = 1; d <= 30; d++)
    for (let s = 0; s < 12; s++) {
      const r = XLR.computePalaces(m, d, s);
      for (const k of ['monthPalace', 'dayPalace', 'hourPalace'])
        if (!Number.isInteger(r[k]) || r[k] < 0 || r[k] > 5) bad++;
    }
check('4320 组全部落在 0-5 宫位', bad, 0);

console.log('== 便捷入口 ==');
const dv = XLR.divination(2026, 8, 31, 14);
check('divination(2026,8,31,14) 时宫=留连', dv.palaces.hourPalace, 1);
check('divination 农历=七月十九', [dv.lunar.month, dv.lunar.day], [7, 19]);

console.log('== 报数起课锚点 ==');
// 文献锚点①：《三宫神断》随机报数起课例——报数 473 → 赤口、赤口、空亡
check('报数 473 → 赤口/赤口/空亡', XLR.computeByNumbers([4, 7, 3]), { monthPalace: 3, dayPalace: 3, hourPalace: 5 });
// 文献锚点②：数字起卦法例——报数 1,2,2 → 大安、留连、速喜
check('报数 1,2,2 → 大安/留连/速喜', XLR.computeByNumbers([1, 2, 2]), { monthPalace: 0, dayPalace: 1, hourPalace: 2 });
check('报数 1,1,1 → 大安/大安/大安', XLR.computeByNumbers([1, 1, 1]), { monthPalace: 0, dayPalace: 0, hourPalace: 0 });
check('一数模式：报 7 展开为 [7,7,7]', XLR.expandNumbers('one', [7]), [7, 7, 7]);
check('三数模式：原样取 [4,7,3]', XLR.expandNumbers('three', [4, 7, 3]), [4, 7, 3]);
check('一数连环：报 7 → 大安/大安/大安', XLR.computeByNumbers(XLR.expandNumbers('one', [7])), { monthPalace: 0, dayPalace: 0, hourPalace: 0 });
check('大数报 999 不越界（天宫=速喜）', XLR.computeByNumbers([999, 999, 999]).monthPalace, 2);

console.log('== 报数全量遍历（1-30 三数共 27000 组，无越界）==');
let bad2 = 0;
for (let a = 1; a <= 30; a++)
  for (let b = 1; b <= 30; b++)
    for (let c = 1; c <= 30; c++) {
      const r = XLR.computeByNumbers([a, b, c]);
      for (const k of ['monthPalace', 'dayPalace', 'hourPalace'])
        if (!Number.isInteger(r[k]) || r[k] < 0 || r[k] > 5) bad2++;
    }
check('27000 组全部落在 0-5 宫位', bad2, 0);

console.log('== 报数异常输入防御 ==');
check('报 0 兜底为 1', XLR.computeByNumbers([0, 0, 0]), { monthPalace: 0, dayPalace: 0, hourPalace: 0 });
check('报负数兜底为 1', XLR.computeByNumbers([-5, -5, -5]), { monthPalace: 0, dayPalace: 0, hourPalace: 0 });
check('非数字兜底为 1', XLR.computeByNumbers(['abc', null, undefined]), { monthPalace: 0, dayPalace: 0, hourPalace: 0 });

console.log('== 数据表 ==');
check('六宫数量=6', P.length, 6);
check('六宫顺序', P.map(p => p.name), ['大安', '留连', '速喜', '赤口', '小吉', '空亡']);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
