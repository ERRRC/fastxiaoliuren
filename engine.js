/*
 * 小六壬起课引擎（教学原型 v0.1）
 * 依赖 vendor/solarlunar.min.js（solarlunar@2.0.7，MIT）做公农历互转
 * 浏览器：暴露 window.XLR；Node：module.exports（供 test.js 使用）
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./vendor/solarlunar.min.js'));
  } else {
    root.XLR = factory(root.solarlunar);
  }
})(typeof self !== 'undefined' ? self : this, function (sol) {
  'use strict';

  // 十二时辰，子=0 … 亥=11
  var SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 六宫顺序（传统六宫版，掐指路线：食指根→食指尖→中指尖→无名指尖→无名指根→中指根）
  var PALACE_ORDER = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'];

  // 小时(0-23) → 时辰序号。23点与0点同为子时。
  function shichenIndex(hour) {
    return Math.floor(((hour + 1) % 24) / 2);
  }

  // 时辰序号 → [起始小时, 结束小时]（未时 → [13,15]）
  function shichenRange(idx) {
    return [(idx * 2 + 23) % 24, (idx * 2 + 1) % 24];
  }

  // 公历 → 农历。返回 {year, month, day, isLeap, monthCn, dayCn, gzDay}
  function solar2lunar(y, m, d) {
    var r = sol.solar2lunar(y, m, d);
    return {
      year: r.lYear,
      month: r.lMonth,
      day: r.lDay,
      isLeap: !!r.isLeap,
      monthCn: r.monthCn,
      dayCn: r.dayCn,
      gzYear: r.gzYear,
      gzMonth: r.gzMonth,
      gzDay: r.gzDay
    };
  }

  /*
   * 起课核心：月上起日、日上起时。
   * 月宫 = (月-1) mod 6（大安起正月）
   * 日宫 = (月宫 + 日-1) mod 6（月落宫起初一）
   * 时宫 = (日宫 + 时辰序) mod 6（日落宫起子时）
   * 注意：闰月按本月数（传统通行做法）；lunarMonth 传数字月份即可。
   */
  function computePalaces(lunarMonth, lunarDay, shichenIdx) {
    var mp = (lunarMonth - 1) % 6;
    var dp = (mp + lunarDay - 1) % 6;
    var hp = (dp + shichenIdx) % 6;
    return { monthPalace: mp, dayPalace: dp, hourPalace: hp };
  }

  // 便捷：公历日期 + 小时 → 一步出结果
  function divination(y, m, d, hour) {
    var lunar = solar2lunar(y, m, d);
    var si = shichenIndex(hour);
    var pal = computePalaces(lunar.month, lunar.day, si);
    return { lunar: lunar, shichenIdx: si, palaces: pal };
  }

  /*
   * 报数起课：把报出的数字当作「月、日、时」依次数，走法与时间起课完全相同
   * （数超过 6 就绕圈数）。
   *   天宫 = (数1 − 1) mod 6          （从大安起，数到 1 落大安）
   *   地宫 = (天宫 + 数2 − 1) mod 6   （从天宫起，数到 1 落天宫）
   *   人宫 = (地宫 + 数3 − 1) mod 6   （从地宫起，数到 1 落地宫）
   * 只报一个数时按民间通行的「同数连数三次」：把这一个数当作三数各用一遍。
   * nums 为长度 3 的数组（一数模式由 expandNumbers 展开）。
   * 文献锚点：报数 473 → 天宫赤口、地宫赤口、人宫空亡。
   */
  function computeByNumbers(nums) {
    function clean(v) { var n = parseInt(v, 10); return (isNaN(n) || n < 1) ? 1 : n; }
    var a = clean(nums[0]), b = clean(nums[1]), c = clean(nums[2]);
    var p1 = (a - 1) % 6;
    var p2 = (p1 + b - 1) % 6;
    var p3 = (p2 + c - 1) % 6;
    return { monthPalace: p1, dayPalace: p2, hourPalace: p3 };
  }

  // 归一化报数：'one' 把单个数连数三次；'three' 原样取三个数
  function expandNumbers(mode, vals) {
    if (mode === 'one') return [vals[0], vals[0], vals[0]];
    return [vals[0], vals[1], vals[2]];
  }

  return {
    SHICHEN: SHICHEN,
    PALACE_ORDER: PALACE_ORDER,
    shichenIndex: shichenIndex,
    shichenRange: shichenRange,
    solar2lunar: solar2lunar,
    computePalaces: computePalaces,
    divination: divination,
    computeByNumbers: computeByNumbers,
    expandNumbers: expandNumbers
  };
});
