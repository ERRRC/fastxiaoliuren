// 把源码里的运行时文件同步到 www/（打包前运行）
const fs = require('fs');
const path = require('path');

const files = ['index.html', 'app.js', 'engine.js', 'palaces.js', 'combos.js', 'divine.js', 'questions.js'];
const dirs = ['vendor', 'assets'];
const src = __dirname;
const dst = path.join(__dirname, 'www');

fs.mkdirSync(dst, { recursive: true });
for (const f of files) fs.copyFileSync(path.join(src, f), path.join(dst, f));
for (const d of dirs) {
  // 先删后拷：cpSync 不会清理源目录里已删除的文件，
  // 否则改了资源名（如 palm.png → palm.webp）旧文件会静默留在包里。
  // 删除可能被外层安全策略（回收站不可用）拦下，失败不致命，靠 cpSync 覆盖即可。
  try { fs.rmSync(path.join(dst, d), { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  fs.cpSync(path.join(src, d), path.join(dst, d), { recursive: true });
}
console.log('www/ 已同步');
