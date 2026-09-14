/*
 * 掐指 · 小六壬 v2.0 页面逻辑
 * 四个 Tab：起课（选事类→出断语）／课例／学习（演示·我来算·题库）／速查卡
 *
 * 宪法 v2（见 产品宪法v2与占卜化改造方案-v0.1.md）：
 *   - 允许为具体事类出断语，但断语必须可溯源（palaces.js / combos.js）
 *   - 禁止确定性预测与决策建议；推导内容必须标注「编者推导」
 *   - 疾病/投资/法律三类强制提示，不可关闭
 *   - 诚实原则：课式只由起课时间决定，所问之事不参与计算，不得暗示系统理解了用户的问题
 */
'use strict';

var XLR = window.XLR;
var P = window.PALACES;
var SH = XLR.SHICHEN;
var DIVINE = window.DIVINE;
var $ = function (s, el) { return (el || document).querySelector(s); };
var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

/* ---------- 六宫在掌图上的坐标（图片像素系，底图 1024×1536，viewBox 裁剪 100,40 起） ----------
 * 第一人称视角：左手掌心对着使用者本人，拇指在画面左侧（2026-08-31 依用户实拍照片校正，图已镜像）
 * → 四指自左至右为 食指、中指、无名指、小指，与传统图谱一致（大安左下、赤口右上）
 * 掐指环线：食指根(大安)→食指尖(留连)→中指尖(速喜)→无名指尖(赤口)→无名指根(小吉)→中指根(空亡)
 */
var NODE_POS = [
  [382, 548], // 0 大安 食指根（左起第一根长指的下节，拇指侧）
  [372, 195], // 1 留连 食指尖
  [522, 142], // 2 速喜 中指尖（居中最高）
  [676, 195], // 3 赤口 无名指尖（右起第二根长指）
  [668, 548], // 4 小吉 无名指根
  [522, 535]  // 5 空亡 中指根
];

var CN_NUM = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
function cnDay(n) {
  if (n === 10) return '初十';
  if (n === 20) return '二十';
  if (n === 30) return '三十';
  var a = ['初', '十', '廿', '卅'][Math.floor(n / 10)];
  var b = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][n % 10];
  return n % 10 === 0 ? a + '十' : a + b;
}
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* ---------- 掌图组件 ---------- */
var SVGNS = 'http://www.w3.org/2000/svg';
function el(tag, attrs) {
  var e = document.createElementNS(SVGNS, tag);
  for (var k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

function createPalm(svg, opts) {
  opts = opts || {};
  var nodes = [];
  var g = el('g'); svg.appendChild(g);
  var mover = el('g', { 'class': 'hidden' });
  var dot = el('circle', { r: 20, fill: '#bf3f2c', stroke: '#fff', 'stroke-width': 5 });
  var badge = el('text', {
    y: -32, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 'bold',
    fill: '#bf3f2c', stroke: '#fbf6ea', 'stroke-width': 8, style: 'paint-order:stroke'
  });
  mover.appendChild(dot); mover.appendChild(badge);
  svg.appendChild(mover);

  for (var i = 0; i < 6; i++) {
    var ng = el('g', { 'class': 'node' });
    // 透明命中圈：手机上可见圆只有约 37px，达不到 44px 触控标准。
    // 垫一个 r=70 的透明圆专门吃点击，视觉半径（48）不变。
    // r 上限由指根三宫决定：小吉-空亡-大安 圆心间距仅 140.6，r=70（直径 140）是零压盖的最大值。
    var hit = el('circle', { 'class': 'hit', cx: NODE_POS[i][0], cy: NODE_POS[i][1], r: 70 });
    var c = el('circle', { cx: NODE_POS[i][0], cy: NODE_POS[i][1], r: 48 });
    var t = el('text', { x: NODE_POS[i][0], y: NODE_POS[i][1] + 10, 'text-anchor': 'middle' });
    t.textContent = P[i].name;
    ng.appendChild(hit); ng.appendChild(c); ng.appendChild(t);
    g.appendChild(ng);
    nodes.push(ng);
    (function (idx) {
      ng.addEventListener('click', function () { if (opts.onTap) opts.onTap(idx); });
    })(i);
  }

  var api = {
    nodes: nodes,
    reset: function () {
      nodes.forEach(function (n) { n.setAttribute('class', 'node'); });
      mover.setAttribute('class', 'hidden');
    },
    showLabels: function (visible) {
      nodes.forEach(function (n, i) {
        n.querySelector('text').textContent = visible ? P[i].name : '·';
      });
    },
    markCurrent: function (idx) {
      nodes.forEach(function (n, i) {
        var cls = (n.getAttribute('class') || 'node').replace(/\s*current/g, '');
        if (i === idx) cls += ' current';
        n.setAttribute('class', cls);
      });
    },
    clearCurrent: function () {
      nodes.forEach(function (n) {
        n.setAttribute('class', (n.getAttribute('class') || '').replace(/\s*current/g, ''));
      });
    },
    land: function (idx, isFinal) {
      var cls = (nodes[idx].getAttribute('class') || '').replace(/\s*(current|landed|final|good|shake)/g, '');
      nodes[idx].setAttribute('class', cls + (isFinal ? ' final' : ' landed'));
    },
    markGood: function (idx) {
      nodes[idx].setAttribute('class', 'node good');
    },
    shake: function (idx) {
      nodes[idx].setAttribute('class', 'node shake');
      setTimeout(function () { nodes[idx].setAttribute('class', 'node'); }, 420);
    },
    showDot: function (idx, label) {
      mover.setAttribute('class', '');
      mover.setAttribute('transform', 'translate(' + NODE_POS[idx][0] + ',' + NODE_POS[idx][1] + ')');
      badge.textContent = label;
    },
    setDotLabel: function (label) { badge.textContent = label; },
    hideDot: function () { mover.setAttribute('class', 'hidden'); },
    hop: function (from, to, dur) {
      return new Promise(function (resolve) {
        var x1 = NODE_POS[from][0], y1 = NODE_POS[from][1];
        var x2 = NODE_POS[to][0], y2 = NODE_POS[to][1];
        var dx = x2 - x1, dy = y2 - y1;
        var len = Math.hypot(dx, dy) || 1;
        var cx = (x1 + x2) / 2 + dy / len * 24;   // 外凸弧线
        var cy = (y1 + y2) / 2 - dx / len * 24;
        var t0 = performance.now();
        function frame(t) {
          var k = Math.min(1, (t - t0) / dur);
          var e = k; // 匀速即可，配合节拍感
          var x = (1 - e) * (1 - e) * x1 + 2 * (1 - e) * e * cx + e * e * x2;
          var y = (1 - e) * (1 - e) * y1 + 2 * (1 - e) * e * cy + e * e * y2;
          mover.setAttribute('transform', 'translate(' + x + ',' + y + ')');
          if (k < 1) requestAnimationFrame(frame); else resolve();
        }
        requestAnimationFrame(frame);
      });
    }
  };
  return api;
}

/* ---------- 结果卡 ---------- */
function renderResult(elBox, res, extra) {
  var p = P[res.hourPalace];
  var modern = (window.MODERN_MAP || {});
  elBox.innerHTML =
    '<h3>落宫 · ' + p.name + '</h3>' +
    '<div class="palace-name">' + p.name + '</div>' +
    '<div class="chips"><span class="chip">' + p.finger + '</span>' +
    '<span class="chip">五行 · ' + p.wuxing + '</span>' +
    '<span class="chip">' + p.shen + '</span>' +
    '<span class="chip">' + p.luck + '</span></div>' +
    '<p class="tags">' + p.tags + '</p>' +
    (p.plain ? '<p class="verse" style="border-left-color:var(--verm)"><b>白话：</b>' + p.plain + '</p>' : '') +
    '<p class="verse">' + p.verse + '</p>' +
    '<dl class="topics">' + Object.keys(p.topics).map(function (k) {
      return '<dt>' + k + '</dt><dd>' + p.topics[k] + '</dd>';
    }).join('') + '</dl>' +
    (extra || '') +
    '<p class="note">口诀为通行校正本，文字各本小异；五行六神取通行说法之一。</p>';
  elBox.classList.remove('hidden');
}

/* ---------- 通用：时辰剩余时间 ---------- */
function shichenText(si) {
  var r = XLR.shichenRange(si);
  return SH[si] + '时（' + pad2(r[0]) + ':00–' + pad2(r[1]) + ':00）';
}
function nowInfo() {
  var n = new Date();
  var lunar = XLR.solar2lunar(n.getFullYear(), n.getMonth() + 1, n.getDate());
  var si = XLR.shichenIndex(n.getHours());
  var r = XLR.shichenRange(si);
  var cur = n.getHours() * 60 + n.getMinutes();
  var rem = r[1] * 60 - cur; if (rem <= 0) rem += 1440;
  var remText = (rem >= 60 ? Math.floor(rem / 60) + '小时' : '') + (rem % 60) + '分钟';
  return {
    solarText: n.getFullYear() + '-' + pad2(n.getMonth() + 1) + '-' + pad2(n.getDate()) + ' ' + pad2(n.getHours()) + ':' + pad2(n.getMinutes()),
    lunar: lunar, si: si,
    shichenText: shichenText(si) + '，还剩 ' + remText
  };
}

/* ================= 课程演示 ================= */
var demo = { lm: 7, ld: 19, si: 7, manual: false, speed: 260, running: false, token: 0 };
var palmDemo = createPalm($('#palmDemo'), {});
var SPEEDS = { slow: 420, mid: 260, fast: 150 };

/* 起课页与演示页共用同一套时间参数（demo.lm/ld/si），
   所以两处的步进器与抬头都要同步刷新。 */
function demoSyncSteppers() {
  ['#mVal', '#mVal2'].forEach(function (s) { var e = $(s); if (e) e.textContent = demo.lm + '月'; });
  ['#dVal', '#dVal2'].forEach(function (s) { var e = $(s); if (e) e.textContent = cnDay(demo.ld); });
  ['#sVal', '#sVal2'].forEach(function (s) { var e = $(s); if (e) e.textContent = SH[demo.si] + '时'; });
}
function demoHeadText() {
  if (demo.manual) {
    return '手动设置 · 农历' + CN_NUM[demo.lm - 1] + '月' + cnDay(demo.ld) + ' · ' + SH[demo.si] + '时';
  }
  var n = nowInfo();
  return '公历 ' + n.solarText + ' · 农历' + n.lunar.monthCn + n.lunar.dayCn + ' · ' + n.shichenText;
}
function demoUpdateHead() {
  var text = demoHeadText();
  var st = demo.lm + demo.ld + demo.si + 1;
  var steps = '本次共数 <b>' + st + '</b> 步 ＝ 月 ' + demo.lm + ' ＋ 日 ' + demo.ld + ' ＋ 时 ' + (demo.si + 1);
  ['#demoHead', '#divineHead'].forEach(function (s) { var e = $(s); if (e) e.textContent = text; });
  ['#demoSteps', '#divineSteps'].forEach(function (s) { var e = $(s); if (e) e.innerHTML = steps; });
}

function demoFromNow() {
  var n = nowInfo();
  demo.lm = n.lunar.month; demo.ld = n.lunar.day; demo.si = n.si; demo.manual = false;
  demoSyncSteppers(); demoUpdateHead();
}
function demoStep(key, dir) {
  if (key === 'lm') demo.lm = (demo.lm - 1 + dir + 12) % 12 + 1;
  if (key === 'ld') demo.ld = (demo.ld - 1 + dir + 30) % 30 + 1;
  if (key === 'si') demo.si = (demo.si + dir + 12) % 12;
  demo.manual = true;
  demoSyncSteppers(); demoUpdateHead();
}

// sel 省略时写入课程演示的日志框
function log(html, sel) {
  var box = $(sel || '#demoLog');
  box.insertAdjacentHTML('beforeend', '<div>' + html + '</div>');
  box.scrollTop = box.scrollHeight;
}
function clearLog(sel) { $(sel || '#demoLog').innerHTML = ''; }
function setChip(i, palaceName, state) {
  var c = $$('#demoChips .chip')[i];
  c.textContent = ['月宫', '日宫', '落宫'][i] + ' ' + (palaceName || '·');
  c.className = 'chip' + (state ? ' ' + state : palaceName ? ' done' : '');
}

function demoResetVisual() {
  palmDemo.reset();
  clearLog();
  $('#demoResult').classList.add('hidden');
  setChip(0, null); setChip(1, null); setChip(2, null);
}

function countLabel(kind, n) {
  if (kind === '月') return CN_NUM[n - 1] + '月';
  if (kind === '日') return cnDay(n);
  return SH[n - 1] + '时';
}

function demoRunPhase(ph, token) {
  var speed = demo.speed;
  return new Promise(function (resolve) {
    (async function () {
      var idx = ph.start;
      palmDemo.showDot(idx, countLabel(ph.kind, 1));
      palmDemo.markCurrent(idx);
      await sleep(speed * 1.6); if (token !== demo.token) return resolve();
      for (var n = 2; n <= ph.count; n++) {
        var next = (idx + 1) % 6;
        await palmDemo.hop(idx, next, speed);
        if (token !== demo.token) return resolve();
        idx = next;
        palmDemo.setDotLabel(countLabel(ph.kind, n));
        palmDemo.markCurrent(idx);
        await sleep(speed * 0.5); if (token !== demo.token) return resolve();
      }
      resolve();
    })();
  });
}

async function demoStart() {
  if (demo.running) return;
  demo.running = true; demo.token++;
  var token = demo.token;
  $('#btnDemo').disabled = true;
  demoResetVisual();

  var res = XLR.computePalaces(demo.lm, demo.ld, demo.si);
  var totalSteps = demo.lm + demo.ld + demo.si + 1;
  log('<span class="dim">起课 · 农历' + CN_NUM[demo.lm - 1] + '月' + cnDay(demo.ld) + ' · ' + SH[demo.si] + '时（闰月按本月数）</span>');
  log('<b>本次共数 ' + totalSteps + ' 步 ＝ 月 ' + demo.lm + ' ＋ 日 ' + demo.ld + ' ＋ 时 ' + (demo.si + 1) + '</b>，从〔大安〕起步，顺时针数到底。');

  var phases = [
    { kind: '月', start: 0, count: demo.lm, target: res.monthPalace,
      intro: '第一步 月上起宫：从〔大安〕起正月，顺数至' + CN_NUM[demo.lm - 1] + '月（数 ' + demo.lm + ' 下）',
      formula: '（' + demo.lm + '−1）mod 6 = ' + res.monthPalace },
    { kind: '日', start: res.monthPalace, count: demo.ld, target: res.dayPalace,
      intro: '第二步 日上起宫：从〔' + P[res.monthPalace].name + '〕起初一，顺数至' + cnDay(demo.ld) + '（数 ' + demo.ld + ' 下）',
      formula: '（' + res.monthPalace + '+' + demo.ld + '−1）mod 6 = ' + res.dayPalace },
    { kind: '时', start: res.dayPalace, count: demo.si + 1, target: res.hourPalace,
      intro: '第三步 时上起宫：从〔' + P[res.dayPalace].name + '〕起子时，顺数至' + SH[demo.si] + '时（数 ' + (demo.si + 1) + ' 下）',
      formula: '（' + res.dayPalace + '+' + demo.si + '）mod 6 = ' + res.hourPalace }
  ];

  for (var i = 0; i < phases.length; i++) {
    var ph = phases[i];
    log('<span class="ph">' + ph.intro + '</span>');
    await demoRunPhase(ph, token);
    if (token !== demo.token) return;
    palmDemo.clearCurrent();
    palmDemo.land(ph.target, i === 2);
    setChip(i, P[ph.target].name, i === 2 ? 'final' : 'done');
    log('<span class="res">' + ['月', '日', '时'][i] + '宫 → ' + P[ph.target].name + '　' + ph.formula + '</span>');
    await sleep(420); if (token !== demo.token) return;
  }
  log('<b>掐算完毕。全程共数 ' + totalSteps + ' 步 ＝ 月 ' + demo.lm + ' ＋ 日 ' + demo.ld + ' ＋ 时 ' + (demo.si + 1) + '。</b>');
  renderResult($('#demoResult'), res);
  demo.running = false;
  $('#btnDemo').disabled = false;
}

function demoSkip() {
  if (!demo.running) return;
  demo.token++;
  demo.running = false;
  $('#btnDemo').disabled = false;
  var res = XLR.computePalaces(demo.lm, demo.ld, demo.si);
  palmDemo.reset();
  clearLog();
  log('<span class="dim">（已跳过动画，直接给出过程）</span>');
  log('<b>本次共数 ' + (demo.lm + demo.ld + demo.si + 1) + ' 步 ＝ 月 ' + demo.lm + ' ＋ 日 ' + demo.ld + ' ＋ 时 ' + (demo.si + 1) + '。</b>');
  log('月上起宫：从〔大安〕起正月，数至' + CN_NUM[demo.lm - 1] + '月 → <span class="res">月宫 ' + P[res.monthPalace].name + '</span>');
  log('日上起宫：从〔' + P[res.monthPalace].name + '〕起初一，数至' + cnDay(demo.ld) + ' → <span class="res">日宫 ' + P[res.dayPalace].name + '</span>');
  log('时上起宫：从〔' + P[res.dayPalace].name + '〕起子时，数至' + SH[demo.si] + '时 → <span class="res">落宫 ' + P[res.hourPalace].name + '</span>');
  palmDemo.land(res.monthPalace); palmDemo.land(res.dayPalace); palmDemo.land(res.hourPalace, true);
  setChip(0, P[res.monthPalace].name, 'done'); setChip(1, P[res.dayPalace].name, 'done'); setChip(2, P[res.hourPalace].name, 'final');
  renderResult($('#demoResult'), res);
}

/* ================= 起课（主功能） ================= */
var COMBOS = window.COMBOS;
var divine = { topic: null, mode: 'brief', running: false, token: 0, last: null };
var palmDivine = createPalm($('#palmDivine'), {});

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function topicByKey(k) {
  var r = DIVINE.SPEC.filter(function (s) { return s.key === k; });
  return r.length ? r[0] : null;
}

/* ---------- 事类选择 ---------- */
function renderTopicChips() {
  var host = $('#topicChips');
  host.innerHTML = DIVINE.SPEC.map(function (s) {
    return '<button class="topic' + (divine.topic === s.key ? ' sel' : '') + '" data-topic="' + s.key + '">' +
      s.name + (s.risk ? '<span class="warnmark">⚠</span>' : '') + '</button>';
  }).join('');
  $$('.topic', host).forEach(function (b) {
    b.addEventListener('click', function () {
      divine.topic = b.dataset.topic;
      renderTopicChips();
      var t = topicByKey(divine.topic);
      $('#topicHint').innerHTML = '<b>' + t.name + '</b>：' + t.modern +
        (t.risk ? '　<span class="bad">（高危事类，结果页将显示强制提示）</span>' : '');
      // 已经出过课就按新事类重渲断语，不用重新起课——课式没变，变的只是取哪条断语
      if (divine.last) renderDivineResult(divine.last.res, divine.topic, divine.last.si);
    });
  });
  if (!divine.topic) {
    $('#topicHint').textContent = '选一个事类，再点「起课」。';
  }
}

/* ---------- 三宫 chip ---------- */
function divineSetChip(i, name, state) {
  var c = $$('#divineChips .chip')[i];
  if (!c) return;
  c.textContent = ['月宫', '日宫', '落宫'][i] + ' ' + (name || '·');
  c.className = 'chip' + (state ? ' ' + state : name ? ' done' : '');
}
function divineResetChips() {
  for (var i = 0; i < 3; i++) divineSetChip(i, null);
}

/* ---------- 完整模式：逐格跳步（与演示页同样走法，用起课页自己的掌图） ---------- */
async function divineRunFull(res, token) {
  var phases = [
    { kind: '月', start: 0, count: demo.lm, target: res.monthPalace },
    { kind: '日', start: res.monthPalace, count: demo.ld, target: res.dayPalace },
    { kind: '时', start: res.dayPalace, count: demo.si + 1, target: res.hourPalace }
  ];
  for (var i = 0; i < phases.length; i++) {
    var ph = phases[i];
    var idx = ph.start;
    palmDivine.showDot(idx, countLabel(ph.kind, 1));
    palmDivine.markCurrent(idx);
    await sleep(demo.speed * 1.2);
    if (token !== divine.token) return false;
    for (var n = 2; n <= ph.count; n++) {
      var next = (idx + 1) % 6;
      await palmDivine.hop(idx, next, demo.speed);
      if (token !== divine.token) return false;
      idx = next;
      palmDivine.setDotLabel(countLabel(ph.kind, n));
      palmDivine.markCurrent(idx);
      await sleep(demo.speed * 0.4);
      if (token !== divine.token) return false;
    }
    palmDivine.clearCurrent();
    palmDivine.land(ph.target, i === 2);
    divineSetChip(i, P[ph.target].name, i === 2 ? 'final' : 'done');
    await sleep(360);
    if (token !== divine.token) return false;
  }
  palmDivine.hideDot();
  return true;
}

/* ---------- 起课主流程 ---------- */
async function divineStart() {
  if (divine.running) return;
  var box = $('#divineResult');
  if (!divine.topic) {
    box.innerHTML = '<p class="bad">先在上面选一个事类，再起课。</p>';
    box.classList.remove('hidden');
    return;
  }
  divine.running = true; divine.token++;
  var token = divine.token;
  $('#btnDivine').disabled = true;
  palmDivine.reset();
  divineResetChips();
  box.classList.add('hidden');

  var res = XLR.computePalaces(demo.lm, demo.ld, demo.si);
  var seq = [res.monthPalace, res.dayPalace, res.hourPalace];

  if (divine.mode === 'full') {
    var done = await divineRunFull(res, token);
    if (!done) { divine.running = false; $('#btnDivine').disabled = false; return; }
  } else {
    // 简略：不逐格数，依次点亮三个落点
    for (var i = 0; i < 3; i++) {
      palmDivine.land(seq[i], i === 2);
      divineSetChip(i, P[seq[i]].name, i === 2 ? 'final' : 'done');
      await sleep(300);
      if (token !== divine.token) { divine.running = false; $('#btnDivine').disabled = false; return; }
    }
  }

  divine.last = { res: res, si: demo.si, at: Date.now() };
  renderDivineResult(res, divine.topic, demo.si);
  divine.running = false;
  $('#btnDivine').disabled = false;
}

/* ---------- 格局判定 ----------
 * combos.json 的 condition 是文字描述，这里转成可执行的判定。
 * 判定由编者依 condition 转译，非古法原文——界面上显示的仍是原文 reading 与出处。
 */
function isJi(name) {
  var r = P.filter(function (x) { return x.name === name; });
  return r.length ? r[0].luck.indexOf('吉') === 0 : false;
}
function matchPatterns(nm) {
  var all = (COMBOS && COMBOS.patterns) || [];
  function pick(n) { return all.filter(function (p) { return p.name === n; })[0]; }
  var m = nm[0], d = nm[1], h = nm[2];
  var hits = [];
  /* 按贴合度从高到低排列：越具体的格局越靠前。
     月宫速喜 + 时宫凶，会同时满足「虎头蛇尾」和「先吉后凶」两条，
     而两条的原文都在讲同一件事，全列出来会显得重复甚至自相矛盾，
     所以只把最贴切的一条当主断，其余降级为「亦符合」。 */
  if (m === '速喜' && !isJi(h)) hits.push(pick('虎头蛇尾'));
  if (isJi(m) && isJi(d) && !isJi(h)) hits.push(pick('先吉后凶'));
  if (!isJi(m) && !isJi(d) && isJi(h)) hits.push(pick('苦尽甘来'));
  if (h === '速喜' && !(isJi(m) && isJi(d))) hits.push(pick('先忧后喜'));
  return hits.filter(Boolean);
}

/* ---------- 结果页 ---------- */
/* 来源徽标：结果页每条内容都要能看出"从哪来"。
   四级：通行原文（金）＞ 通行整理（蓝）＞ 编者推导（灰）＞ 兜底总象（浅灰）。
   这是宪法 v2"诚实原则"的 UI 化——不假装所有话都是古法原文。 */
function srcBadge(level, text) {
  return '<span class="src-badge sb-' + level + '">' + text + '</span>';
}
var SRC_CLASSIC = function () { return srcBadge('classic', '通行原文'); };
var SRC_SORTED  = function () { return srcBadge('sorted', '通行整理'); };
var SRC_DERIVE  = function () { return srcBadge('derive', '编者推导'); };

function renderDivineResult(res, topicKey, si) {
  if (si == null) si = divine.last && divine.last.si;
  var T = topicByKey(topicKey) || DIVINE.SPEC[0];
  var palaces = [res.monthPalace, res.dayPalace, res.hourPalace];
  var nm = [P[palaces[0]].name, P[palaces[1]].name, P[palaces[2]].name];
  var roleName = ['月宫', '日宫', '时宫'];
  var stageName = ['起因', '过程', '结局'];
  var roles = DIVINE.sancai();
  var h = '';

  // ① 高危强制提示（置顶，不可关闭）
  if (T.risk) h += '<div class="warnbar">' + DIVINE.WARN[T.risk] + '</div>';

  // ② 所问
  h += '<h3>所问 · ' + T.name + '</h3><p class="tags">' + T.modern + '</p>';

  // ③ 课式三宫
  h += '<div class="lesson">';
  for (var i = 0; i < 3; i++) {
    var p = P[palaces[i]];
    h += '<div class="lesson-cell' + (i === 2 ? ' final' : '') + '">' +
      '<div class="lc-role">' + stageName[i] + ' · ' + roleName[i] + '</div>' +
      '<div class="lc-name">' + p.name + '</div>' +
      '<div class="lc-meta">' + p.wuxing + ' · ' + p.fang + ' · ' + p.shen + '</div></div>';
  }
  h += '</div><p class="note" style="margin:2px 0 0">观课以时宫为定论，但不可只看时宫孤立下断。</p>';

  // ④ 四步推演
  h += '<h3 style="margin-top:18px">怎么断这一课</h3>';

  // 一、三才
  h += '<div class="step"><h4>一、看三才 ' + SRC_SORTED() + '</h4>';
  for (var a = 0; a < 3; a++) {
    var r = roles[a];
    h += '<div class="gist"><b>' + roleName[a] + ' ' + nm[a] + '</b>' +
      (r ? '（' + r.role + '）：' + r.reading : '') + '</div>';
  }
  h += '<span class="src">出处：三才合论·通行教法</span></div>';

  // 二、日加时
  var pr = DIVINE.pair(nm[1], nm[2]);
  h += '<div class="step"><h4>二、看日加时（' + nm[1] + ' 加 ' + nm[2] + '）' +
    (pr.kind === 'classic' ? SRC_CLASSIC() : srcBadge('note', '本作补注')) + '</h4>';
  if (pr.kind === 'classic') {
    if (pr.data.verse && pr.data.verse.length) {
      h += '<div class="gist" style="color:var(--gold);font-weight:bold">' + pr.data.verse.join('　') + '</div>';
    }
    h += '<div class="gist">' + (pr.data.plain || []).join('<br>') + '</div>';
    h += '<div class="gist"><b>' + pr.data.gist + '</b></div>';
    h += '<span class="src">出处：' + pr.data.source + '</span>';
  } else if (pr.kind === 'note') {
    h += '<div class="gist">' + (pr.data.plain || []).join('<br>') + '</div>';
    h += '<div class="gist"><b>' + pr.data.gist + '</b></div>';
    h += '<span class="src">出处：' + pr.data.source + '</span>';
  } else {
    h += '<div class="gist">此组合无通行断语，按常法以两宫本义参看。</div>';
  }
  h += '</div>';

  // 三、格局
  var pats = matchPatterns(nm);
  h += '<div class="step"><h4>三、看格局 ' + SRC_SORTED() + '</h4>';
  if (!pats.length) {
    h += '<div class="gist">不入特定格局，按常法以三宫与断语通断。</div>';
  } else {
    /* combos 的 reading 是用具体宫名举例写的（如「时见空亡」），
       照抄会与本课实际宫位对不上——用户会以为断错了。
       这里保留可溯源的原文，再补一行本课实况把两者对上。 */
    var top = pats[0];
    h += '<div class="gist"><b>' + top.name + '</b>：' + top.reading + '</div>';
    h += '<div class="gist" style="color:var(--ink2);font-size:13.5px">' +
      '格局条件：' + top.condition + '　→　本课 月 ' + nm[0] + '、日 ' + nm[1] + '、时 ' + nm[2] + '</div>';
    h += '<span class="src">出处：' + top.source + '</span>';
    if (pats.length > 1) {
      h += '<div class="gist" style="color:var(--ink2);font-size:13px;margin-top:4px">亦符合：' +
        pats.slice(1).map(function (pt) { return pt.name; }).join('、') + '</div>';
    }
  }
  h += '</div>';

  // 四、五行深析：生克流向（展开）+ 六亲/体用（默认折叠）
  var wx = [P[palaces[0]].wuxing, P[palaces[1]].wuxing, P[palaces[2]].wuxing];
  var rels = [[0, 1], [1, 2], [0, 2]];
  h += '<div class="step"><h4>四、看五行生克 ' + SRC_DERIVE() + '</h4>';
  rels.forEach(function (rr) {
    var x = DIVINE.wxRel(wx[rr[0]], wx[rr[1]]);
    h += '<div class="gist">' + roleName[rr[0]] + ' ' + nm[rr[0]] + '（' + wx[rr[0]] + '）→ ' +
      roleName[rr[1]] + ' ' + nm[rr[1]] + '（' + wx[rr[1]] + '）：<b>' + x.rel + '</b>，' + x.desc + '</div>';
  });
  h += '<div class="gist" style="margin-top:4px">生我助我者为助力，克我者为阻力。</div>';

  // 四-b 深析折叠区：六亲 + 体用
  var myWx = wx[2];
  var ty = si != null ? DIVINE.tiyong(myWx, si) : null;
  h += '<details class="fold"><summary>深析：六亲与体用</summary>';
  h += '<div class="gist"><b>六亲（以时宫' + nm[2] + '·' + myWx + '为「我」）</b></div>';
  [[0, '月宫'], [1, '日宫']].forEach(function (it) {
    var lq = DIVINE.liuqin(myWx, wx[it[0]]);
    h += '<div class="gist">' + it[1] + ' ' + nm[it[0]] + '（' + wx[it[0]] + '）→ <b>' + lq.rel + '</b>：' + lq.desc + '</div>';
  });
  if (ty) {
    h += '<div class="gist"><b>体用</b></div>';
    h += '<div class="gist">体＝时宫（' + myWx + '），用＝起课时辰（' + ty.use + '）：<b>' + ty.rel + '</b>，' + ty.desc + '</div>';
  }
  h += '<div class="gist" style="color:var(--ink2);font-size:13px">六亲、体用为五行常法机械推导，小六壬古本无此用法，供参看。</div>';
  h += '</details>';
  h += '<span class="src">编者按五行常法推导，非古法原文 · 五行归属依 palaces.js</span></div>';

  // ⑤ 该事类在三宫上的断语（带来源徽标）
  h += '<h3 style="margin-top:18px">' + T.name + ' · 三宫断语</h3>';
  for (var k = 0; k < 3; k++) {
    var tl = DIVINE.topicLines(palaces[k], T.name);
    var badge = tl.kind === 'verse' ? SRC_CLASSIC() :
      (tl.kind === 'topic' ? srcBadge('sorted', '专条白话') :
        srcBadge('fallback', '本宫总象'));
    h += '<div class="duan' + (tl.kind === 'fallback' ? ' miss' : '') + '">' +
      '<span class="duan-who">' + roleName[k] + '　' + nm[k] + '</span>' + badge + '<br>' +
      tl.items.map(function (it) {
        return it.line ? '<span class="duan-verse">' + it.line + '</span>——' + it.plain : it.plain;
      }).join('<br>') +
      (tl.src ? '<br><span class="src">来源：' + tl.src + '</span>' : '') +
      '</div>';
  }

  // ⑤-b 其他事类参考（折叠）：同课不同问——课式相同，问的事不同，断语不同
  h += '<details class="fold"><summary>同课不同问：这一课其他事类怎么看</summary>';
  h += '<p class="note" style="margin:2px 0 8px">课式只由起课时间决定，同一课式换个事类就是另一条断语——这正是「选事类查断语」而非「替你断事」的意思。</p>';
  DIVINE.SPEC.forEach(function (s) {
    if (s.key === T.key) return;
    var otl = DIVINE.topicLines(palaces[2], s.name);
    var txt = otl.items[0] ? otl.items[0].plain : '';
    if (otl.kind === 'fallback') {
      h += '<div class="gist"><b>' + s.name + '</b>（' + nm[2] + '）：无专条，' + txt + '</div>';
    } else {
      h += '<div class="gist"><b>' + s.name + '</b>（' + nm[2] + '）：' + txt + '</div>';
    }
  });
  h += '</details>';

  // ⑥ 存入课例
  h += '<div class="btns"><button class="btn" id="btnSaveCase">存入课例</button></div>';

  // ⑦ 免责（固定，不可关闭）
  h += '<p class="disclaimer">' + DIVINE.DISCLAIMER + '</p>';

  var box = $('#divineResult');
  box.innerHTML = h;
  box.classList.remove('hidden');
  var sb = $('#btnSaveCase');
  if (sb) sb.addEventListener('click', function () { caseAdd(res, topicKey); });
}

/* ================= 课例 ================= */
/* localStorage 在某些环境会直接抛错（隐私模式、opaque origin 等）。
   原来的写法是 try/catch 静默吞掉，结果就是：用户点了「存入课例」，
   什么反馈都没有——看起来像功能坏了。这里加一层内存兜底，
   至少本次会话内功能完整可用，退出后丢失也比静默失败好。 */
var caseMem = null;
function caseStore() {
  try {
    var v = localStorage.getItem('xlr_cases');
    if (v == null) return caseMem || [];
    return JSON.parse(v || '[]');
  } catch (e) { return caseMem || []; }
}
function caseSave(list) {
  caseMem = list;
  try { localStorage.setItem('xlr_cases', JSON.stringify(list)); } catch (e) {}
}
function caseTimeText(c) {
  var d = new Date(c.at);
  var when = isNaN(d.getTime()) ? '' :
    (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  return '农历' + CN_NUM[c.lm - 1] + '月' + cnDay(c.ld) + ' ' + SH[c.si] + '时 · 存于' + when;
}
function caseAdd(res, topicKey) {
  var list = caseStore();
  list.unshift({
    id: 'c' + Date.now(),
    at: new Date().toISOString(),
    topic: topicKey,
    lm: demo.lm, ld: demo.ld, si: demo.si,
    res: res, note: ''
  });
  caseSave(list.slice(0, 200));
  caseRender();
  switchTab('cases');
}
function caseRender() {
  var host = $('#caseList');
  if (!host) return;
  var list = caseStore();
  if (!list.length) {
    host.innerHTML = '<p class="note" style="margin-top:0">还没有课例。去「起课」页出课后点「存入课例」。</p>';
    return;
  }
  host.innerHTML = list.map(function (c) {
    var T = topicByKey(c.topic);
    var r = c.res;
    return '<div class="case" data-id="' + c.id + '">' +
      '<div class="case-head"><span class="case-topic">' + (T ? T.name : c.topic) + '</span>' +
      '<span class="case-time">' + caseTimeText(c) + '</span></div>' +
      '<div class="case-palaces">课式：' + P[r.monthPalace].name + ' · ' + P[r.dayPalace].name +
      ' · ' + P[r.hourPalace].name + '（时宫为定论）</div>' +
      '<div class="case-note">' + (c.note ? '备忘：' + escapeHtml(c.note) :
        '<span style="color:var(--ink2)">（未写备忘）</span>') + '</div>' +
      '<div class="case-ops"><button class="btn ghost small" data-caseact="note">写备忘</button> ' +
      '<button class="btn ghost small" data-caseact="del">删除</button></div></div>';
  }).join('');

  $$('.case', host).forEach(function (wrap) {
    var id = wrap.dataset.id;
    $$('[data-caseact]', wrap).forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.caseact === 'del') {
          caseSave(caseStore().filter(function (c) { return c.id !== id; }));
          caseRender();
          return;
        }
        // 内联展开编辑框——不用 prompt()，避免依赖 WebView 的 JS 对话框支持
        var old = $('.note-edit', wrap);
        if (old) { old.parentNode.removeChild(old); return; }
        var cur = caseStore().filter(function (c) { return c.id === id; })[0];
        var box = document.createElement('div');
        box.className = 'note-edit';
        box.style.marginTop = '8px';
        box.innerHTML = '<textarea class="note-in" placeholder="写一句备忘（只存在本机，不影响断语）">' +
          escapeHtml(cur && cur.note || '') + '</textarea>' +
          '<div class="btns"><button class="btn small" data-casesave="1">保存</button>' +
          '<button class="btn ghost small" data-casecancel="1">取消</button></div>';
        wrap.appendChild(box);
        $('[data-casesave]', box).addEventListener('click', function () {
          var v = $('textarea', box).value;
          var l = caseStore();
          l.forEach(function (c) { if (c.id === id) c.note = v; });
          caseSave(l); caseRender();
        });
        $('[data-casecancel]', box).addEventListener('click', function () { caseRender(); });
      });
    });
  });
}

/* ================= 我来算 ================= */
var palmQuiz = createPalm($('#palmQuiz'), { onTap: onQuizTap });
var quiz = { state: null, today: false };

function quizNew(useToday) {
  quiz.today = !!useToday;
  var lm, ld, si;
  if (useToday) {
    var n = nowInfo(); lm = n.lunar.month; ld = n.lunar.day; si = n.si;
  } else {
    lm = Math.floor(Math.random() * 12) + 1;
    ld = Math.floor(Math.random() * 29) + 1;
    si = Math.floor(Math.random() * 12);
  }
  quiz.state = {
    lm: lm, ld: ld, si: si,
    res: XLR.computePalaces(lm, ld, si),
    phase: 0, mistakes: 0, lock: false
  };
  palmQuiz.reset();
  $('#quizResult').classList.add('hidden');
  $('#quizFeedback').textContent = '';
  quizRenderHead();
}
function quizRenderHead() {
  var q = quiz.state;
  $('#quizTitle').textContent = '教材题 · 农历' + CN_NUM[q.lm - 1] + '月' + cnDay(q.ld) + ' · ' + SH[q.si] + '时';
  var names = ['① 月宫', '② 日宫', '③ 落宫'];
  var targets = [q.res.monthPalace, q.res.dayPalace, q.res.hourPalace];
  $('#quizSteps').innerHTML = names.map(function (nm, i) {
    var cls = 'chip';
    var txt = nm;
    if (i < q.phase) {
      cls += q.results && q.results[i] ? ' done' : ' miss';
      txt = nm + ' ' + P[targets[i]].name + (q.results && q.results[i] ? ' ✓' : ' ✗');
    } else if (i === q.phase) { cls += ' current'; txt = nm + ' ？'; }
    return '<span class="' + cls + '">' + txt + '</span>';
  }).join('') + '<span class="chip">错 ' + q.mistakes + ' 步</span>';
}
function onQuizTap(idx) {
  var q = quiz.state;
  if (!q || q.phase >= 3 || q.lock) return;
  var targets = [q.res.monthPalace, q.res.dayPalace, q.res.hourPalace];
  var names = ['月宫', '日宫', '时宫（落宫）'];
  var expect = targets[q.phase];
  var fb = $('#quizFeedback');
  q.results = q.results || [true, true, true];

  if (idx === expect) {
    q.lock = true;
    palmQuiz.markGood(idx);
    fb.innerHTML = '<span class="ok">✓ ' + names[q.phase] + '：' + P[expect].name + '</span>';
    setTimeout(function () {
      q.lock = false;
      palmQuiz.land(idx, q.phase === 2);
      quizAdvance();
    }, 380);
  } else {
    q.mistakes++; q.results[q.phase] = false;
    palmQuiz.shake(idx);
    palmQuiz.land(expect, q.phase === 2);
    fb.innerHTML = '<span class="bad">✗ ' + names[q.phase] + '应为〔' + P[expect].name + '〕，你点的是〔' + P[idx].name + '〕。继续下一步。</span>';
    quizAdvance();
  }
}
function quizAdvance() {
  var q = quiz.state;
  q.phase++;
  quizRenderHead();
  if (q.phase >= 3) {
    var extra = '<p class="mistakes ' + (q.mistakes ? 'bad' : 'ok') + '">' +
      (q.mistakes === 0 ? '三步全对，掐得干净。' : '本题共错 ' + q.mistakes + ' 步。再掐一遍，不看答案。') + '</p>' +
      '<div class="btns"><button class="btn" onclick="quizNew(false)">换一题</button>' +
      '<button class="btn ghost" onclick="quizNew(true)">重掐本题（今天）</button></div>';
    renderResult($('#quizResult'), q.res, extra);
    $('#quizFeedback').textContent = '';
  }
}

/* ================= 引擎自检 ================= */
function runSelfTest() {
  var rows = [];
  function t(desc, actual, expected) {
    rows.push({
      desc: desc,
      expected: JSON.stringify(expected),
      actual: JSON.stringify(actual),
      pass: JSON.stringify(actual) === JSON.stringify(expected)
    });
  }
  var a = XLR.solar2lunar(2026, 8, 31);
  t('2026-08-31 → 农历七月十九', a.monthCn + a.dayCn, '七月十九');
  t('2026-02-17（春节）→ 正月初一', (function () { var r = XLR.solar2lunar(2026, 2, 17); return r.monthCn + r.dayCn; })(), '正月初一');
  t('2025-01-29（春节）→ 正月初一', (function () { var r = XLR.solar2lunar(2025, 1, 29); return r.monthCn + r.dayCn; })(), '正月初一');
  t('14点 → 未时', XLR.SHICHEN[XLR.shichenIndex(14)] + '时', '未时');
  t('23点 → 子时', XLR.SHICHEN[XLR.shichenIndex(23)] + '时', '子时');
  t('七月十九未时 → 大安·大安·留连', (function () { var r = XLR.computePalaces(7, 19, 7); return [P[r.monthPalace].name, P[r.dayPalace].name, P[r.hourPalace].name].join('·'); })(), '大安·大安·留连');
  t('三月初五酉时 → 速喜·大安·赤口', (function () { var r = XLR.computePalaces(3, 5, 9); return [P[r.monthPalace].name, P[r.dayPalace].name, P[r.hourPalace].name].join('·'); })(), '速喜·大安·赤口');

  var n = nowInfo();
  $('#testRows').innerHTML = rows.map(function (r) {
    return '<div class="trow"><span class="' + (r.pass ? 'pass' : 'fail') + '">' + (r.pass ? '✓' : '✗') + '</span>' +
      '<span class="tdesc">' + r.desc + '</span>' +
      '<span class="tval">' + r.actual + '</span></div>';
  }).join('') +
    '<div class="trow"><span class="pass">●</span><span class="tdesc">今日实时核验</span><span class="tval">' +
    n.solarText + ' → 农历' + n.lunar.monthCn + n.lunar.dayCn + ' · ' + n.shichenText + '</span></div>';
}

/* ================= 题库 ================= */
var QBANK = window.QUESTIONS || [];
var bank = { mode: null, queue: [], idx: 0, cur: null, sel: [], answered: false };

// 与 caseStore 同样的静默失败隐患，一并加内存兜底
var bankMem = null;
function bankStore() {
  try {
    var v = localStorage.getItem('xlr_bank');
    if (v == null) return bankMem || {};
    return JSON.parse(v || '{}');
  } catch (e) { return bankMem || {}; }
}
function bankSave(d) {
  bankMem = d;
  try { localStorage.setItem('xlr_bank', JSON.stringify(d)); } catch (e) {}
}
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// 「起课计算」无限生成题：教材式中性题干，引擎出答案
// 模板池：时宫/月宫/日宫（时间起课）+ 天宫/人宫（报三数）+ 报一数 + 反推日（难度3）
function genQuestion() {
  var P6 = [0, 1, 2, 3, 4, 5].map(function (i) { return P[i].name; });
  function mk(stem, correct, explain, diff, chapter) {
    var others = shuffle([0, 1, 2, 3, 4, 5].filter(function (i) { return i !== correct; })).slice(0, 3);
    var opts = shuffle([correct].concat(others));
    return {
      id: 'gen', type: 'single', chapter: chapter || '起课计算', tags: ['起课计算'], difficulty: diff || 2,
      stem: stem,
      options: opts.map(function (i) { return P6[i]; }),
      answer: [opts.indexOf(correct)],
      explanation: explain
    };
  }
  function palaceName(i) { return P6[i]; }

  var t = Math.random();
  if (t < 0.14) {
    // 反推日（难度3）：农历X月，日宫落回大安，最小是初几？
    var lm6 = 1 + Math.floor(Math.random() * 12);
    var mp6 = (lm6 - 1) % 6;
    var dayMin = ((6 - mp6) % 6) + 1; // (mp + d - 1) mod 6 = 0 的最小正解
    var ds = [dayMin, dayMin + 1 > 29 ? dayMin - 1 : dayMin + 1,
              dayMin + 2 > 29 ? dayMin - 2 : dayMin + 2,
              dayMin + 3 > 29 ? dayMin - 3 : dayMin + 3];
    var uniq = []; ds.forEach(function (d) { if (d >= 1 && d <= 29 && uniq.indexOf(d) < 0) uniq.push(d); });
    var dayOpts = shuffle(uniq).slice(0, 4);
    if (dayOpts.indexOf(dayMin) < 0) dayOpts[0] = dayMin;
    var optsN = shuffle(dayOpts);
    return {
      id: 'gen', type: 'single', chapter: '起课计算', tags: ['起课计算', '反推'], difficulty: 3,
      stem: '教材例题：农历' + CN_NUM[lm6 - 1] + '月起课，想让日宫恰好落回大安，这个月最小是初几？',
      options: optsN.map(function (d) { return cnDay(d); }),
      answer: [optsN.indexOf(dayMin)],
      explanation: '日宫 =（月宫 + 日 − 1）mod 6。' + CN_NUM[lm6 - 1] + '月的月宫 =（' + lm6 + '−1）mod 6 = ' + mp6 + '（' + palaceName(mp6) + '）。要落回大安（0），即（' + mp6 + ' + 日 − 1）mod 6 = 0，最小正解为' + cnDay(dayMin) + '。注意「最小」——' + cnDay(dayMin) + '之后每加 6 天也会落回大安。'
    };
  } else if (t < 0.32) {
    // 报三数：天宫或人宫
    var a1 = 1 + Math.floor(Math.random() * 9), b1 = 1 + Math.floor(Math.random() * 9), c1 = 1 + Math.floor(Math.random() * 9);
    var rn = XLR.computeByNumbers([a1, b1, c1]);
    var askSky = Math.random() < 0.5;
    var correctN = askSky ? rn.monthPalace : rn.hourPalace;
    return mk(
      '教材例题：报数起课，随手报三个数 ' + a1 + '、' + b1 + '、' + c1 + '，' + (askSky ? '天宫（第一个数数到的宫）' : '人宫（第三个数数到的宫）') + '落哪一宫？',
      correctN,
      '报三数与时间起课同构：把三个数依次当作「月、日、时辰」。' +
      '天宫 =（' + a1 + '−1）mod 6 = ' + rn.monthPalace + '（' + palaceName(rn.monthPalace) + '）；' +
      '地宫 =（' + rn.monthPalace + '+' + b1 + '−1）mod 6 = ' + rn.dayPalace + '（' + palaceName(rn.dayPalace) + '）；' +
      '人宫 =（' + rn.dayPalace + '+' + c1 + '−1）mod 6 = ' + rn.hourPalace + '（' + palaceName(rn.hourPalace) + '）。' +
      (askSky ? '问的是天宫。' : '问的是人宫。'),
      2
    );
  } else if (t < 0.44) {
    // 报一数：同数连数三次（通行算法）
    var n1 = 1 + Math.floor(Math.random() * 9);
    var rn1 = XLR.computeByNumbers(XLR.expandNumbers('one', [n1]));
    return mk(
      '教材例题：只报一个数 ' + n1 + ' 起课（通行算法：同一数连数三次），人宫落哪一宫？',
      rn1.hourPalace,
      '报一个数按通行「同数连数三次」处理：相当于报 ' + n1 + '、' + n1 + '、' + n1 + '（流派有差异，教材按此通行算法）。' +
      '天宫 =（' + n1 + '−1）mod 6 = ' + rn1.monthPalace + '（' + palaceName(rn1.monthPalace) + '）；' +
      '地宫 =（' + rn1.monthPalace + '+' + n1 + '−1）mod 6 = ' + rn1.dayPalace + '（' + palaceName(rn1.dayPalace) + '）；' +
      '人宫 =（' + rn1.dayPalace + '+' + n1 + '−1）mod 6 = ' + rn1.hourPalace + '（' + palaceName(rn1.hourPalace) + '）。',
      2
    );
  } else if (t < 0.62) {
    // 月宫
    var lm2 = 1 + Math.floor(Math.random() * 12);
    var mp2 = (lm2 - 1) % 6;
    return mk(
      '教材例题：农历' + CN_NUM[lm2 - 1] + '月' + cnDay(1 + Math.floor(Math.random() * 29)) + '日起课，月宫落在哪一宫？',
      mp2,
      '月宫 =（月−1）mod 6 =（' + lm2 + '−1）mod 6 = ' + mp2 + '（' + palaceName(mp2) + '）。口诀：大安起正月，顺数至所占之月。',
      2
    );
  } else if (t < 0.80) {
    // 日宫
    var lm3 = 1 + Math.floor(Math.random() * 12), ld3 = 1 + Math.floor(Math.random() * 29);
    var mp3 = (lm3 - 1) % 6, dp3 = (mp3 + ld3 - 1) % 6;
    return mk(
      '教材例题：农历' + CN_NUM[lm3 - 1] + '月' + cnDay(ld3) + '日起课，日宫落在哪一宫？',
      dp3,
      '月宫 =（' + lm3 + '−1）mod 6 = ' + mp3 + '（' + palaceName(mp3) + '）；从月宫起初一，日宫 =（' + mp3 + '+' + ld3 + '−1）mod 6 = ' + dp3 + '（' + palaceName(dp3) + '）。',
      2
    );
  } else {
    // 时宫（原有模板）
    var lm4 = 1 + Math.floor(Math.random() * 12), ld4 = 1 + Math.floor(Math.random() * 29), si4 = Math.floor(Math.random() * 12);
    var r4 = XLR.computePalaces(lm4, ld4, si4);
    return mk(
      '教材例题：农历' + CN_NUM[lm4 - 1] + '月' + cnDay(ld4) + '日' + SH[si4] + '时起课，最终落宫（时宫）是？',
      r4.hourPalace,
      '三步推演：月宫 =（' + lm4 + '−1）mod 6 = ' + r4.monthPalace + '（' + palaceName(r4.monthPalace) + '）；' +
      '日宫 =（' + r4.monthPalace + '+' + ld4 + '−1）mod 6 = ' + r4.dayPalace + '（' + palaceName(r4.dayPalace) + '）；' +
      '时宫 =（' + r4.dayPalace + '+' + si4 + '）mod 6 = ' + r4.hourPalace + '（' + palaceName(r4.hourPalace) + '）。',
      2
    );
  }
}

function bankStart(mode) {
  bank.mode = mode; bank.idx = 0;
  $$('#bankModes .btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.bank === mode);
  });
  if (mode === 'random') {
    bank.queue = shuffle(QBANK.map(function (q) { return q.id; }));
  } else if (mode === 'gen') {
    bank.queue = ['gen'];
  } else if (mode === 'wrong') {
    var d = bankStore();
    bank.queue = shuffle(Object.keys(d.wrong || {}));
    if (!bank.queue.length) {
      bank.cur = null;
      $('#bankMeta').innerHTML = '';
      $('#bankStem').textContent = '错题本是空的——先去刷几题吧。';
      $('#bankOptions').innerHTML = '';
      $('#bankFeedback').innerHTML = '';
      $('#btnNext').classList.add('hidden');
      return;
    }
  } else {
    // 章节练习：按题库原始顺序出题（基础题在前），不打乱
    bank.queue = QBANK.filter(function (q) { return q.chapter === mode; })
      .map(function (q) { return q.id; });
  }
  bankRender();
}

function bankRender() {
  var q;
  if (bank.mode === 'gen') {
    q = genQuestion();
  } else {
    var id = bank.queue[bank.idx % bank.queue.length];
    q = QBANK.find(function (x) { return x.id === id; });
  }
  bank.cur = q; bank.sel = []; bank.answered = false;

  var typeLabel = { single: '单选', judge: '判断', multi: '多选' }[q.type] || q.type;
  $('#bankMeta').innerHTML =
    '<span class="chip">' + q.chapter + '</span>' +
    '<span class="chip">' + typeLabel + '</span>' +
    '<span class="chip">难度 ' + q.difficulty + '</span>' +
    (bank.mode === 'gen' ? '' :
      '<span class="chip">第 ' + (bank.idx % bank.queue.length + 1) + ' / ' + bank.queue.length + ' 题</span>');
  $('#bankStem').textContent = q.stem;
  $('#bankFeedback').innerHTML = '';
  $('#btnNext').classList.add('hidden');

  var box = $('#bankOptions');
  box.innerHTML = '';
  q.options.forEach(function (opt, i) {
    var b = document.createElement('button');
    b.className = 'opt';
    b.innerHTML = '<b>' + 'ABCD'[i] + '.</b> ' + opt;
    b.addEventListener('click', function () {
      if (bank.answered) return;
      if (q.type === 'multi') {
        b.classList.toggle('sel');
        var k = bank.sel.indexOf(i);
        if (k >= 0) bank.sel.splice(k, 1); else bank.sel.push(i);
        var conf = $('#bankConfirm');
        if (conf) conf.classList.toggle('hidden', bank.sel.length === 0);
      } else {
        bankSubmit([i]);
      }
    });
    box.appendChild(b);
  });
  if (q.type === 'multi') {
    var c = document.createElement('button');
    c.className = 'btn small hidden';
    c.id = 'bankConfirm';
    c.textContent = '确认答案';
    c.addEventListener('click', function () {
      if (!bank.answered && bank.sel.length) bankSubmit(bank.sel.slice().sort());
    });
    box.appendChild(c);
  }
}

// 解析增强：分段 + 时辰/生肖全表（正确项标红）
function buildExplainHtml(q) {
  var html = (q.explanation || '').replace(/(【(?:白话|现实|闰月是什么)】)/g, '<br>$1').trim();
  var ST = window.SHICHEN_TABLE;
  if (!ST) return html;
  if (q.listKind === 'shichen') {
    var items = ST.map(function (s) {
      var clock = s.clock;
      return s.name === q.listHi
        ? '<span class="qhl">' + s.name + '</span>（' + clock + '）'
        : s.name + '（' + clock + '）';
    });
    html += '<br><span class="qhl-cap">十二时辰对照：</span>' + items.join('、') + '。';
  } else if (q.listKind === 'zhi') {
    var items2 = ST.map(function (s) {
      var pair = s.name.charAt(0) + s.animal;
      return pair === q.listHi ? '<span class="qhl">' + pair + '</span>' : pair;
    });
    html += '<br><span class="qhl-cap">十二地支生肖：</span>' + items2.join('、') + '。';
  }
  return html;
}

function bankSubmit(selArr) {
  var q = bank.cur;
  if (!q || bank.answered) return;
  bank.answered = true;
  var ok = selArr.length === q.answer.length &&
    q.answer.every(function (a) { return selArr.indexOf(a) >= 0; });

  var opts = $$('#bankOptions .opt');
  q.answer.forEach(function (ai) { if (opts[ai]) opts[ai].classList.add('right'); });
  if (!ok && opts[selArr[0]]) opts[selArr[0]].classList.add('wrong');
  opts.forEach(function (o) { o.disabled = true; });
  var conf = $('#bankConfirm'); if (conf) conf.classList.add('hidden');

  $('#bankFeedback').innerHTML =
    '<div class="' + (ok ? 'ok' : 'bad') + '" style="font-weight:bold">' +
    (ok ? '✓ 答对了' : '✗ 答错了，正确答案：' + q.answer.map(function (a) { return 'ABCD'[a]; }).join('')) +
    '</div><div class="bank-expl">' + buildExplainHtml(q) + '</div>';

  // 记录统计与错题本（生成题不入错题本）
  var d = bankStore();
  d.stats = d.stats || { a: 0, r: 0, ch: {} };
  d.stats.a++; if (ok) d.stats.r++;
  d.stats.ch[q.chapter] = d.stats.ch[q.chapter] || { a: 0, r: 0 };
  d.stats.ch[q.chapter].a++; if (ok) d.stats.ch[q.chapter].r++;
  if (q.id !== 'gen') {
    d.wrong = d.wrong || {};
    if (ok) {
      if (d.wrong[q.id]) {
        d.wrong[q.id].streak++;
        if (d.wrong[q.id].streak >= 2) delete d.wrong[q.id];
      }
    } else {
      d.wrong[q.id] = { n: (d.wrong[q.id] ? d.wrong[q.id].n : 0) + 1, streak: 0 };
    }
  }
  bankSave(d);
  bankStatsRender();
  $('#btnNext').textContent = bank.mode === 'gen' ? '再来一题' : '下一题';
  $('#btnNext').classList.remove('hidden');
}

function bankNext() {
  if (bank.mode === 'gen') { bankRender(); return; }
  bank.idx++;
  if (bank.idx >= bank.queue.length) {
    // 章节练习按原顺序重来；随机/错题本重新打乱
    if (bank.mode === 'random' || bank.mode === 'wrong') bank.queue = shuffle(bank.queue);
    bank.idx = 0;
  }
  bankRender();
}

function bankStatsRender() {
  var d = bankStore();
  var s = d.stats || { a: 0, r: 0, ch: {} };
  var rate = s.a ? Math.round(s.r / s.a * 100) : 0;
  var html = '累计刷题 <b>' + s.a + '</b> 题 · 答对 <b>' + s.r + '</b> · 正确率 <b>' + rate + '%</b>';
  Object.keys(s.ch).forEach(function (ch) {
    var c = s.ch[ch];
    html += '<br>' + ch + '：' + c.a + ' 题 · 正确率 ' + (c.a ? Math.round(c.r / c.a * 100) : 0) + '%';
  });
  $('#bankStats').innerHTML = html;

  var wrong = d.wrong || {};
  var n = Object.keys(wrong).length;
  $('#wrongCount').textContent = n;
  if (!n) {
    $('#wrongList').innerHTML = '空。答错的题会自动收进来。';
    return;
  }
  var byCh = {};
  Object.keys(wrong).forEach(function (id) {
    var q = QBANK.find(function (x) { return x.id === id; });
    if (q) byCh[q.chapter] = (byCh[q.chapter] || 0) + 1;
  });
  $('#wrongList').innerHTML = '共 <b>' + n + '</b> 题待重做（连对 2 次移出）<br>' +
    Object.keys(byCh).map(function (ch) { return ch + ' ' + byCh[ch]; }).join(' · ');
}

/* ================= 速查卡 ================= */
function renderRef() {
  var modern = window.MODERN_MAP || {};
  var host = $('#refPalaces');
  if (host) {
    host.innerHTML = P.map(function (p) {
      var luckCls = p.luck.indexOf('吉') === 0 ? 'ji' : 'xiong';
      var lines = (p.verseLines || []).map(function (l) {
        var mod = modern[l.topic];
        return '<div class="ref-line"><span class="rl-verse">' + l.line + '</span>' +
          '<span class="rl-plain">' + l.plain +
          (mod ? ' <span class="rl-modern">（' + l.topic + '≈' + mod + '）</span>' : '') +
          '</span></div>';
      }).join('');
      return '<div class="ref-palace">' +
        '<div class="ref-head"><span class="rp-arrow">▸</span>' +
        '<span class="rp-name">' + p.name + '</span>' +
        '<span class="rp-luck ' + luckCls + '">' + p.luck + '</span>' +
        '<span class="rp-plain">' + (p.plain || '') + '</span></div>' +
        '<div class="ref-body">' + lines + '</div></div>';
    }).join('');
    $$('.ref-head', host).forEach(function (h) {
      h.addEventListener('click', function () {
        h.parentNode.classList.toggle('open');
      });
    });
  }

  var sc = $('#refShichen');
  if (sc && window.SHICHEN_TABLE) {
    sc.innerHTML = '<table class="sc"><tr><th>时辰</th><th>现代钟点</th><th>别称</th><th>生肖</th><th>提示</th></tr>' +
      window.SHICHEN_TABLE.map(function (s) {
        return '<tr><td><b>' + s.name + '</b></td><td>' + s.clock + '</td>' +
          '<td>' + s.alias + '</td><td>' + s.animal + '</td>' +
          '<td class="dim">' + (s.tip || '') + '</td></tr>';
      }).join('') + '</table>';
  }

  var md = $('#refModern');
  if (md) {
    md.innerHTML = '<table class="sc"><tr><th>传统事类</th><th>今天大致对应</th></tr>' +
      Object.keys(modern).map(function (k) {
        return '<tr><td><b>' + k + '</b></td><td class="dim">' + modern[k] + '</td></tr>';
      }).join('') + '</table>';
  }
}

/* ================= 启动 ================= */
/* Tab 切换统一入口：按钮、左右滑、系统返回键三方共用同一套逻辑，
   避免"两套返回语义打架"。 */
var TAB_ORDER = ['divine', 'cases', 'learn', 'ref']; // 左滑→下一个，右滑→上一个
var currentTab = 'divine';
var tabHistory = []; // 返回键的历史栈

function activateTab(name) {
  $$('.tabs button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  $$('.panel').forEach(function (p) {
    p.classList.toggle('active', p.id === 'tab-' + name);
  });
  if (name === 'cases') caseRender();
  currentTab = name;
}
function switchTab(name, noHistory) {
  if (!name || name === currentTab) return;
  if (!noHistory) {
    tabHistory.push(currentTab);
    if (tabHistory.length > 20) tabHistory.shift();
  }
  activateTab(name);
}

(function init() {
  // 标签页
  $$('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () { switchTab(b.dataset.tab); });
  });

  /* 左右滑切换 Tab（触屏专属）。
     三个约束缺一不可：
     ① 起点离屏幕左右边缘 >30px —— 避开系统边缘滑返回手势的拦截区；
     ② 横向位移 ≥60px 且大于纵向的 1.5 倍 —— 别把上下滚动误判成切页；
     ③ 起点不在 .log 等内部滚动区 —— 那里的横向滑动可能是误触。 */
  (function () {
    var sx = 0, sy = 0, armed = false;
    document.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      sx = t.clientX; sy = t.clientY;
      armed = sx > 30 && sx < window.innerWidth - 30 &&
        !(e.target.closest && e.target.closest('.log'));
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (!armed) return;
      armed = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      var i = TAB_ORDER.indexOf(currentTab);
      var next = dx < 0 ? TAB_ORDER[i + 1] : TAB_ORDER[i - 1];
      if (next) switchTab(next);
    }, { passive: true });
  })();

  /* Android 返回（由 MainActivity.onBackPressed 调）：
     有 Tab 历史先回退；退无可退时 2 秒内按第二次才真正退出。
     返回 false = 放行给系统退出。 */
  var lastBackAt = 0;
  window.__xlrBack = function () {
    if (tabHistory.length) { activateTab(tabHistory.pop()); return true; }
    var now = Date.now();
    if (now - lastBackAt < 2000) return false;
    lastBackAt = now;
    var t = document.getElementById('backToast');
    if (t) {
      t.classList.add('show');
      setTimeout(function () { t.classList.remove('show'); }, 1800);
    }
    return true;
  };

  demoFromNow();

  // 起课（主功能）
  renderTopicChips();
  caseRender();
  $('#btnDivine').addEventListener('click', function () { divineStart(); });
  $('#btnDivineNow').addEventListener('click', demoFromNow);
  $$('[data-dmode]').forEach(function (b) {
    b.addEventListener('click', function () {
      divine.mode = b.dataset.dmode;
      $$('[data-dmode]').forEach(function (x) {
        x.classList.toggle('active', x.dataset.dmode === divine.mode);
        x.classList.toggle('ghost', x.dataset.dmode !== divine.mode);
      });
    });
  });

  // 学习页子 Tab（演示教学 / 我来算 / 题库）
  $$('.subtabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      var n = b.dataset.sub;
      $$('.subtabs button').forEach(function (x) { x.classList.toggle('active', x.dataset.sub === n); });
      $$('.subpanel').forEach(function (p) { p.classList.toggle('active', p.id === 'sub-' + n); });
    });
  });

  $('#btnDemo').addEventListener('click', demoStart);
  $('#btnSkip').addEventListener('click', demoSkip);
  $('#btnNow').addEventListener('click', demoFromNow);
  /* 步进器：点一次走一格；按住 400ms 后连续步进。
     没有这个，手机上把农历日从初一点到三十要戳 29 次小按钮。 */
  /* 起课页与演示页各有自己的一组步进器（data-step / data-step2），
     但共用同一份时间参数，所以绑成同一套行为。 */
  $$('[data-step],[data-step2]').forEach(function (b) {
    var key = b.dataset.step || b.dataset.step2, dir = parseInt(b.dataset.dir, 10);
    var holdTimer = null, repeatTimer = null, repeated = false;
    function stopRepeat() {
      clearTimeout(holdTimer); clearInterval(repeatTimer);
      holdTimer = null; repeatTimer = null;
    }
    b.addEventListener('pointerdown', function () {
      repeated = false;
      holdTimer = setTimeout(function () {
        repeated = true;
        repeatTimer = setInterval(function () { demoStep(key, dir); }, 110);
      }, 400);
    });
    // 手指滑动导致浏览器接管滚动时会触发 pointercancel，连发随即停止
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      b.addEventListener(ev, stopRepeat);
    });
    b.addEventListener('click', function () {
      if (!repeated) demoStep(key, dir);
    });
  });
  $$('[data-speed]').forEach(function (b) {
    b.addEventListener('click', function () {
      demo.speed = SPEEDS[b.dataset.speed];
      $$('[data-speed]').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
    });
  });

  quizNew(true);
  $('#btnQuizToday').addEventListener('click', function () { quizNew(true); });
  $('#btnQuizRandom').addEventListener('click', function () { quizNew(false); });
  $('#btnLabels').addEventListener('change', function (e) {
    palmQuiz.showLabels(e.target.checked);
  });

  // 题库
  (function () {
    var counts = {};
    QBANK.forEach(function (q) { counts[q.chapter] = (counts[q.chapter] || 0) + 1; });
    // 章节按钮动态生成（按题库里出现的顺序）
    var chapHost = $('#bankChapters');
    if (chapHost) {
      Object.keys(counts).forEach(function (ch) {
        var b = document.createElement('button');
        b.className = 'btn ghost small';
        b.dataset.bank = ch;
        b.textContent = ch + '（' + counts[ch] + '）';
        chapHost.appendChild(b);
      });
    }
    $$('#bankModes [data-bank]').forEach(function (b) {
      var m = b.dataset.bank;
      if (counts[m]) b.textContent = m + '（' + counts[m] + '）';
      b.addEventListener('click', function () { bankStart(m); });
    });
    $('#btnNext').addEventListener('click', bankNext);
    bankStatsRender();
  })();

  renderRef(); // 速查卡

  runSelfTest(); // 页面加载即跑一遍，标签页里随时可看
})();
