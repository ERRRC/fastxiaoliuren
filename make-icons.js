// 生成 Android 应用图标：红印章底 + 六颗星（五实一空，对应六宫）
const sharp = require('sharp');
const path = require('path');
const res = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

const RED = '#BF3F2C', GOLD = '#9C7C3C', WHITE = '#FBF6EA';

// 六宫圆点：2 列 × 3 行，最后一颗（空亡）为空心
function dots(cx, cy, r, gapX, gapY) {
  const pos = [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]];
  return pos.map(([dx, dy], i) => {
    const x = cx + dx * gapX, y = cy + dy * gapY;
    if (i === 5) { // 空亡：空心
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${WHITE}" stroke-width="${r * 0.42}"/>`;
    }
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${WHITE}"/>`;
  }).join('');
}

function legacySvg(round) {
  const bg = round
    ? `<circle cx="512" cy="512" r="512" fill="${RED}"/>`
    : `<rect width="1024" height="1024" rx="185" fill="${RED}"/>`;
  const frame = round ? '' :
    `<rect x="46" y="46" width="932" height="932" rx="150" fill="none" stroke="${GOLD}" stroke-width="15" opacity="0.95"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${bg}${frame}${dots(512, 512, 74, 150, 190)}</svg>`;
}

// 自适应图标前景：内容缩进安全区（中央 ~58%）
function foregroundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${dots(512, 512, 52, 108, 136)}</svg>`;
}

const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const fgSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

(async () => {
  for (const [d, s] of Object.entries(sizes)) {
    const dir = path.join(res, `mipmap-${d}`);
    await sharp(Buffer.from(legacySvg(false))).resize(s, s).png().toFile(path.join(dir, 'ic_launcher.png'));
    await sharp(Buffer.from(legacySvg(true))).resize(s, s).png().toFile(path.join(dir, 'ic_launcher_round.png'));
  }
  for (const [d, s] of Object.entries(fgSizes)) {
    await sharp(Buffer.from(foregroundSvg())).resize(s, s).png()
      .toFile(path.join(res, `mipmap-${d}`, 'ic_launcher_foreground.png'));
  }
  console.log('图标已生成');
})();
