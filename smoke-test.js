/*
 * 冒烟测试（jsdom）—— 改动 app.js / index.html 后建议跑一次
 *
 * 目的：app.js 全是 DOM 操作，任何 null 引用都会让真机白屏，而这类错误
 *       node test.js（纯引擎测试）抓不到。本脚本模拟真实加载与交互。
 * 战绩：v1.4 首次运行时抓到「算法说明卡片空白」——bsAlgoText() 定义了，
 *       却忘了在 bsRecompute() 里赋值；纯靠肉眼审查很难发现。
 *
 * 依赖 jsdom（已写进 package.json 的 devDependencies，不参与运行时）：
 *   npm install
 * 运行：
 *   node smoke-test.js      （或 npm run smoke）
 * 注意：脚本直接读仓库根目录的源文件（index.html / app.js …），跑之前先 node sync-www.js 不是必须的。
 *
 * 做法：把 index.html 里的 <script src> 内联成真实 <script>，用 dangerously 模式加载，
 *       使 var 声明挂到 window（贴近浏览器）。
 * 注意：jsdom 的 outside-only + window.eval 模式下 var 不挂 window，读不到内部状态，
 *       必须用 dangerously + 内联脚本；静态核对「js 引用的 id 是否都在 html」会对
 *       运行时动态创建的元素（如 bankConfirm）误报，需人工甄别。
 * 历史：v1.4 曾新增「报数起课」Tab，用户体验后要求删除（v1.5 移除界面入口，
 *       engine 的 computeByNumbers/expandNumbers 与 test.js 锚点保留）；本脚本
 *       保留「报数入口已移除」的防回归检查。
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
const errors = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '\n       ' + detail : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PROJ = __dirname.replace(/\\/g, '/');   // 以脚本自身位置定位项目，移动目录也不失效
const FILES = ['vendor/solarlunar.min.js', 'engine.js', 'palaces.js', 'combos.js', 'divine.js', 'questions.js', 'app.js'];

// 把外链脚本内联，保证同步执行且 var 挂到 window
let html = fs.readFileSync(path.join(PROJ, 'index.html'), 'utf8');
const codes = {};
for (const f of FILES) {
  codes[f] = fs.readFileSync(path.join(PROJ, f), 'utf8');
  const re = new RegExp('<script src="' + esc(f) + '[^"]*"><\\/script>');
  if (!re.test(html)) { errors.push('未找到脚本标签: ' + f); continue; }
  html = html.replace(re, () => '<script>' + codes[f] + '</script>');
}

// url 用 http://localhost 而不是 file://：jsdom 下 file:// 是 opaque origin，
// localStorage 会直接抛 SecurityError；真机 Capacitor 的 origin 正是 http://localhost，
// 用 http 才测得到真实行为。
const dom = new JSDOM(html, { url: 'http://localhost/index.html', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
const d = w.document;
w.addEventListener('error', e => errors.push('window error: ' + e.message));

(async function () {
  await sleep(200);   // 给 init 一点余量

  console.log('== 脚本加载与初始化 ==');
  check('无 JS 异常', errors.length === 0, errors.join(' | '));
  check('XLR 引擎已挂载', typeof w.XLR === 'object');
  check('PALACES 6 宫已挂载', Array.isArray(w.PALACES) && w.PALACES.length === 6);
  check('COMBOS 组合课断已挂载', w.COMBOS && w.COMBOS.pairs.length === 30 && w.COMBOS.patterns.length === 5);
  check('DIVINE 占断配置已挂载', w.DIVINE && w.DIVINE.SPEC.length === 10);
  check('主 Tab 共 4 个', d.querySelectorAll('.tabs:not(.subtabs) button').length === 4,
    '实际 ' + d.querySelectorAll('.tabs:not(.subtabs) button').length + ' 个');
  check('学习页子 Tab 共 3 个', d.querySelectorAll('.subtabs button').length === 3,
    '实际 ' + d.querySelectorAll('.subtabs button').length + ' 个');
  check('报数起课入口已移除（防回归）',
    !d.querySelector('#tab-baoshu') && !/bsSetMode|palmBaoshu/.test(codes['app.js']));

  console.log('== 起课：主流程 ==');
  check('事类 chip 渲染 10 个', d.querySelectorAll('#topicChips .topic').length === 10,
    '实际 ' + d.querySelectorAll('#topicChips .topic').length + ' 个');
  // 未选事类就起课，应给出提示而不是崩
  d.querySelector('#btnDivine').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(120);
  check('未选事类时给出提示', /选一个事类/.test(d.querySelector('#divineResult').textContent));

  // 选「失物」后起课（简略模式）
  d.querySelector('[data-topic="lost"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  errors.length = 0;
  d.querySelector('#btnDivine').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  let dw = 0;
  while (d.querySelector('#divineResult').classList.contains('hidden') && dw < 10000) {
    await sleep(200); dw += 200;
  }
  const dr = d.querySelector('#divineResult');
  check('起课无 JS 异常', errors.length === 0, errors.join(' | '));
  check('结果卡出现', !dr.classList.contains('hidden'), '等待 ' + dw + 'ms 后仍未出现');
  check('结果含课式三宫', dr.querySelectorAll('.lesson-cell').length === 3);
  check('结果含四步推演', dr.querySelectorAll('.step').length === 4,
    '实际 ' + dr.querySelectorAll('.step').length + ' 步');
  check('结果含三宫断语', dr.querySelectorAll('.duan').length === 3);
  check('结果含免责声明', /不构成对任何具体事项的预测/.test(dr.textContent));
  check('低危事类无强制提示条', dr.querySelectorAll('.warnbar').length === 0);

  // 切到高危事类（疾病）应出现强制提示，且不必重新起课
  d.querySelector('[data-topic="ill"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(120);
  check('切高危事类后强制提示出现',
    d.querySelectorAll('#divineResult .warnbar').length === 1 &&
    /及时就医/.test(d.querySelector('#divineResult .warnbar').textContent));

  // 存入课例
  d.querySelector('#btnSaveCase').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(150);
  check('存入课例后自动跳到课例页', d.querySelector('#tab-cases').classList.contains('active'));
  check('课例列表出现 1 条', d.querySelectorAll('#caseList .case').length === 1,
    '实际 ' + d.querySelectorAll('#caseList .case').length + ' 条');

  console.log('== 我来算：出题与判卷一步 ==');
  d.querySelector('#tab-learn .subtabs [data-sub="quiz"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  d.querySelector('#btnQuizRandom').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const q = w.quiz && w.quiz.state;
  check('随机出题成功', q && q.res && typeof q.res.monthPalace === 'number');
  const nodes = d.querySelectorAll('#palmQuiz .node');
  check('掌图生成 6 个可点节点', nodes.length === 6, '实际 ' + nodes.length);
  nodes[q.res.monthPalace].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(500);
  check('答对月宫，进度推进', w.quiz.state.phase === 1, 'phase=' + w.quiz.state.phase);

  console.log('== 演示模式：动画无异常 ==');
  errors.length = 0;
  d.querySelector('#tab-learn .subtabs [data-sub="demo"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  d.querySelector('#btnDemo').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  let waited = 0;
  while (d.querySelector('#demoResult').classList.contains('hidden') && waited < 30000) {
    await sleep(300); waited += 300;
  }
  check('演示过程无 JS 异常', errors.length === 0, errors.join(' | '));
  check('演示结束后结果卡出现', !d.querySelector('#demoResult').classList.contains('hidden'),
    '等待 ' + waited + 'ms 后仍未出现');

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('\n测试脚本异常：', e.message); process.exit(1); });
