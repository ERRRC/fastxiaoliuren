/*
 * 占断配置层（手写源，勿生成）
 * 职责：事类清单 · 高危标记 · 断语查询 · 免责与高危提示文案
 *
 * 溯源纪律：本文件不存断语。所有断语都从 palaces.js 实时查询，
 * 组合课断从 combos.js 查询。新增事类只加映射，不写断语。
 *
 * 宪法 v2 约束（见 产品宪法v2与占卜化改造方案-v0.1.md）：
 *   - 断语必须可溯源，不得杜撰
 *   - 禁止确定性预测与决策建议
 *   - 疾病 / 投资 / 法律 三类强制提示，不可关闭
 *   - 不得暗示系统理解了用户的问题（课式只由起课时间决定，所问之事不参与计算）
 *
 * 浏览器：window.DIVINE；Node：module.exports
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./palaces.js').PALACES,
      require('./combos.js'),
      require('./palaces.js').SHICHEN_TABLE);
  } else {
    root.DIVINE = factory(root.PALACES, root.COMBOS, root.SHICHEN_TABLE);
  }
})(typeof self !== 'undefined' ? self : this, function (PALACES, COMBOS, SHICHEN) {
  'use strict';

  // palaces.js 两端导出形态不同：浏览器 root.PALACES 是数组，
  // Node 的 module.exports 是 {PALACES, SHICHEN_TABLE, MODERN_MAP}。
  // 这里统一取成数组，否则 Node 下回归测试会静默查不到任何断语。
  var PAL = Array.isArray(PALACES) ? PALACES : ((PALACES && PALACES.PALACES) || []);

  /* ---------- 事类清单 ----------
   * name 必须与 palaces.js 的 topics / verseLines.topic 用字一致，否则查不到断语。
   * risk：null 普通；'medical' 医疗；'invest' 投资；'legal' 法律
   */
  var SPEC = [
    { key: 'money',  name: '求财', modern: '工资奖金、投资回报、回款报销、副业收入', risk: 'invest' },
    { key: 'lost',   name: '失物', modern: '丢手机、快递丢失、钥匙钱包找不到',       risk: null },
    { key: 'person', name: '行人', modern: '等回复、约的人来不来、出差的人回没回',   risk: null },
    { key: 'ill',    name: '疾病', modern: '体检结果、看病挂号、术后康复',           risk: 'medical' },
    { key: 'lawsuit',name: '官事', modern: '官司、劳动仲裁、合同纠纷、罚款投诉',     risk: 'legal' },
    { key: 'travel', name: '出行', modern: '出差旅行、赶飞机高铁、通勤路上',         risk: null },
    { key: 'seek',   name: '求谋', modern: '求职面试、升职加薪、考研考公、项目立项', risk: null },
    { key: 'deal',   name: '交易', modern: '签合同、谈合作、买卖二手、平台交易',     risk: null },
    { key: 'marry',  name: '婚姻', modern: '恋爱相亲、复合、订婚、离婚',             risk: null },
    { key: 'house',  name: '宅舍', modern: '租房买房、装修搬家',                     risk: null }
  ];

  /* ---------- 强制提示文案 ---------- */
  var WARN = {
    medical: '此为本法通行断语，不构成医疗建议。身体不适请及时就医，勿以占断延误诊治。',
    invest:  '此为本法通行断语，不构成投资建议。投资决策请咨询持牌专业人士。',
    legal:   '此为本法通行断语，不构成法律意见。涉法事项请咨询执业律师。'
  };

  var DISCLAIMER = '本应用断语摘自传统小六壬通行本，属民俗文化内容，不构成对任何具体事项的预测或决策建议。';

  /* ---------- 断语查询 ----------
   * 三档降级，绝不杜撰：
   *   ① 口诀原句（verseLines 中 topic 命中）→ 最可溯源，带原文
   *   ② 专条白话（topics 命中）→ 编者转译
   *   ③ 本宫总象（plain）→ 无专条时兜底，界面必须标注"非专条"
   */
  function topicLines(palaceIdx, topicName) {
    var p = PAL[palaceIdx];
    if (!p) return { kind: 'fallback', items: [], src: null };

    var verses = (p.verseLines || []).filter(function (l) { return l.topic === topicName; });
    if (verses.length) {
      return {
        kind: 'verse',
        src: '通行口诀',
        items: verses.map(function (l) { return { line: l.line, plain: l.plain }; })
      };
    }
    if (p.topics && p.topics[topicName]) {
      return {
        kind: 'topic',
        src: (p.topicSources && p.topicSources[topicName]) || '编者白话转译',
        items: [{ line: null, plain: p.topics[topicName] }]
      };
    }
    return {
      kind: 'fallback',
      src: '本宫总象',
      items: [{ line: null, plain: p.plain }]
    };
  }

  // 事类在某一宫上是否真有专条（用于界面标注"待补"）
  function hasSpecial(palaceIdx, topicName) {
    return topicLines(palaceIdx, topicName).kind !== 'fallback';
  }

  /* ---------- 三才定位 ---------- */
  function sancai() { return (COMBOS && COMBOS.sancai) || []; }

  /* ---------- 日加时诀 ----------
   * 通行本只有异宫 30 组；同宫（如日大安、时大安）无原文。
   * 同宫概率约 1/6（时辰序 mod 6 = 0），必须兜底，且明确标注为补注。
   */
  function pair(dayName, hourName) {
    var hit = (COMBOS && COMBOS.pairs || []).filter(function (x) {
      return x.a === dayName && x.b === hourName;
    })[0];
    if (hit) return { kind: 'classic', data: hit };
    if (dayName === hourName) {
      return {
        kind: 'note',
        data: {
          gist: '日时同宫，课体纯一，吉凶之力加倍，以该宫本义断之。',
          plain: ['日宫与时宫落在同一宫，事情首尾一贯，少有反复。'],
          source: '本体系补注（通行本日加时诀仅收异宫 30 组，未收同宫）'
        }
      };
    }
    return { kind: 'none', data: null };
  }

  /* ---------- 五行生克 ----------
   * 三宫五行关系。编者按五行常法推导，非古法原文——界面必须标注。
   */
  var WX_ORDER = ['木', '火', '土', '金', '水'];
  function wxRel(a, b) {
    if (a === b) return { rel: '比和', desc: '同类相扶，力量叠加' };
    var ia = WX_ORDER.indexOf(a), ib = WX_ORDER.indexOf(b);
    if ((ia + 1) % 5 === ib) return { rel: '生', desc: a + '生' + b + '，前者助益后者' };
    if ((ib + 1) % 5 === ia) return { rel: '被生', desc: b + '生' + a + '，后者助益前者' };
    if ((ia + 2) % 5 === ib) return { rel: '克', desc: a + '克' + b + '，前者牵制后者' };
    return { rel: '被克', desc: b + '克' + a + '，后者牵制前者' };
  }

  /* ---------- 六亲 ----------
   * 以时宫（定论宫）五行为"我"，对月宫/日宫判定六亲。
   * 判定规则是五行常法机械推导，通行于子平/六亲体系——
   * 小六壬古本并无六亲用法，界面必须标注"编者推导"。
   */
  function liuqin(myWx, otherWx) {
    if (myWx === otherWx) return { rel: '兄弟', desc: '同我者。同辈、竞争或合作，力量相当' };
    var r = wxRel(myWx, otherWx);
    if (r.rel === '生') return { rel: '子孙', desc: '我生者。晚辈、产出、福德，我付出而滋养之' };
    if (r.rel === '被生') return { rel: '父母', desc: '生我者。庇护、长辈、文书，外部滋养我' };
    if (r.rel === '克') return { rel: '妻财', desc: '我克者。财富、收获，可驾驭但需出力' };
    return { rel: '官鬼', desc: '克我者。压力、阻力、疾病、官府，需提防' };
  }

  /* ---------- 体用 ----------
   * 体 = 时宫五行（事情本身/定论），用 = 起课时辰地支五行（外部环境/动向）。
   * 同为五行常法推导，非古法原文。
   */
  function tiyong(bodyWx, shichenIdx) {
    var useWx = (SHICHEN && SHICHEN[shichenIdx] && SHICHEN[shichenIdx].wx) || null;
    if (!useWx) return null;
    var r = wxRel(bodyWx, useWx);
    var m;
    if (r.rel === '比和')    m = '体用同气，内外一致，课面顺而不悖';
    else if (r.rel === '生') m = '体生用（' + bodyWx + '生' + useWx + '），我力外泄，耗而不聚，付出多';
    else if (r.rel === '被生') m = '用生体（' + useWx + '生' + bodyWx + '），外环境助我，得助力';
    else if (r.rel === '克') m = '体克用（' + bodyWx + '克' + useWx + '），事可为我所制，但需主动出力';
    else m = '用克体（' + useWx + '克' + bodyWx + '），外压于我，阻力大，宜避锋芒';
    return { use: useWx, rel: r.rel, desc: m };
  }

  return {
    SPEC: SPEC,
    WARN: WARN,
    DISCLAIMER: DISCLAIMER,
    topicLines: topicLines,
    hasSpecial: hasSpecial,
    sancai: sancai,
    pair: pair,
    wxRel: wxRel,
    liuqin: liuqin,
    tiyong: tiyong,
    // 供调试与回归测试：统计每个事类能查到专条的宫数
    coverage: function () {
      return SPEC.map(function (s) {
        var n = 0;
        for (var i = 0; i < 6; i++) if (hasSpecial(i, s.name)) n++;
        return { name: s.name, covered: n + '/6' };
      });
    }
  };
});
