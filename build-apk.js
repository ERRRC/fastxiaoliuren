/*
 * 一键打包 APK（跨平台）：node build-apk.js [release|debug]
 *
 * 做的事：
 *   1) node sync-www.js          源码 → www/
 *   2) npx cap sync android      www/ → android/app/src/main/assets/public/ + 补齐 Capacitor 生成文件
 *   3) gradlew assembleRelease   （或 assembleDebug）
 *   4) 把产物拷到 dist/掐指小六壬-v<versionName>.apk 并打印体积与签名提示
 *
 * 可选参数：
 *   --copy-only   跳过 `cap sync`，只做 sync-www.js + 手动拷贝 www/ 到 android assets。
 *                 用于本机 `cap sync` 会删插件目录的环境（见 docs/交接文档.md 第六节 7）；
 *                 前提是 android/app/src/main/assets/ 下的 Capacitor 生成文件已存在。
 *
 * 环境要求（见 docs/BUILD.md）：Node 18+、JDK 17、Android SDK（platform 34）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = __dirname;
const androidDir = path.join(root, 'android');
const args = process.argv.slice(2);
const mode = args.includes('debug') ? 'debug' : 'release';
const copyOnly = args.includes('--copy-only');
const task = mode === 'debug' ? 'assembleDebug' : 'assembleRelease';
const isWin = process.platform === 'win32';

function run(cmd, cmdArgs, opts) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(' ')}`);
  const r = spawnSync(cmd, cmdArgs, opts);
  if (r.error) throw r.error;
  if (r.status !== 0) {
    console.error(`\n[失败] 命令退出码 ${r.status}：${cmd} ${cmdArgs.join(' ')}`);
    process.exit(r.status || 1);
  }
}

// 走 shell 的命令（Windows 上的 .bat/.cmd：npx、gradlew.bat）。
// 注意别把带空格的 node 可执行文件路径交给 shell，会因未加引号被 cmd 拆断。
function runShell(cmdline, opts) {
  return run(cmdline, [], Object.assign({ stdio: 'inherit', cwd: root, shell: true }, opts));
}

// 1) 源码 → www/
run(process.execPath, [path.join(root, 'sync-www.js')], { stdio: 'inherit', cwd: root });

// 2) www/ → android
if (copyOnly) {
  const dst = path.join(androidDir, 'app', 'src', 'main', 'assets', 'public');
  if (!fs.existsSync(dst)) {
    console.error(`\n[失败] ${dst} 不存在。--copy-only 只适用于已跑过 cap sync 的本机；` +
      '全新 clone 请去掉该参数，或先执行 npx cap sync android。');
    process.exit(1);
  }
  // 先删后拷：避免换资源名后旧文件静默留在包里。
  // 某些机器上 rmSync 会被外层安全策略接管（走回收站并报失败），此时忽略错误、靠覆盖兜底。
  try { fs.rmSync(dst, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  fs.cpSync(path.join(root, 'www'), dst, { recursive: true });
  console.log('已手动拷贝 www/ → android/app/src/main/assets/public/（跳过 cap sync）');
} else {
  runShell('npx cap sync android');
}

// 3) 打包
runShell(isWin ? `gradlew.bat ${task} --console=plain` : `./gradlew ${task} --console=plain`,
  { cwd: androidDir });

// 4) 收集产物
const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', mode, `app-${mode}.apk`);
if (!fs.existsSync(apkPath)) {
  console.error(`[失败] 没找到产物 ${apkPath}`);
  process.exit(1);
}
const gradleFile = fs.readFileSync(path.join(androidDir, 'app', 'build.gradle'), 'utf8');
const versionName = (gradleFile.match(/versionName\s+"([^"]+)"/) || [])[1] || 'unknown';
const versionCode = (gradleFile.match(/versionCode\s+(\d+)/) || [])[1] || '?';

const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });
const outPath = path.join(distDir, `掐指小六壬-v${versionName}${mode === 'debug' ? '-debug' : ''}.apk`);
fs.copyFileSync(apkPath, outPath);
const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);

console.log(`\n[完成] versionName ${versionName} (versionCode ${versionCode}) · ${mb} MB`);
console.log(`       产物：${outPath}`);
if (mode === 'release') {
  console.log('       发布前记得：versionCode 是否已 +1、是否已用发布签名（若控制台出现"[签名] 未找到 release 签名配置"则当前是 debug 签名）。');
}
