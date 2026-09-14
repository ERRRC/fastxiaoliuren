# 给 GPT 的手掌图生成提示词

> 用途：替换"掐指 · 小六壬入门"原型里的 SVG 手掌，作为六宫交互节点的底图。
> 图片到货后存到 `仓库根目录\assets\palm.png`，然后告诉 ZCode 来做节点校准。

---

## 主提示词（英文版，推荐直接复制）

```
A flat, front-facing illustration of a human LEFT HAND, palm facing straight
toward the viewer, fingers pointing straight up, in the style of a traditional
Chinese woodblock print (banhua) for an old divination chart.

Composition and pose:
- The hand is perfectly vertical and centered; fingers point straight up
- It is a LEFT hand seen from the owner's own viewpoint (palm facing the viewer as if the viewer is the owner), so the thumb is on the LEFT side of the image
- Index, middle and ring fingers: straight, parallel, clearly separated by
  small even gaps; all three the same length visually
- Pinky: natural, shorter, set slightly lower
- Finger joints and creases clearly visible; the palm itself kept plain and
  uncluttered
- The hand fills about 80% of the frame height with clean, even margins

Style:
- Traditional Chinese woodblock print for a medical/divination chart
- Background: solid flat cream color, exact hex #F6F1E5, no texture, no
  gradient, no vignette
- Clean dark ink outlines (#2A251D) with subtle minimal interior lines
- A few muted vermilion red (#BF3F2C) accent lines marking the finger joint
  creases is welcome
- Flat 2D, orthographic straight-on view; no perspective, no 3D, no
  foreshortening, no drop shadows

Strictly avoid:
- Any text, Chinese characters, numbers, labels, seals, stamps or watermarks
- Detailed fingernails, jewelry, tattoos, wrist or forearm
- Photorealism, glossy 3D rendering, dramatic lighting
- Fingers touching each other or bent

Output: PNG, portrait orientation, 1024x1536.
```

## 中文备份版（如果英文效果不好再试）

```
一只人的左手，掌心正对观者（第一人称视角，如同看自己的左手掌），五指朝上，竖直居中构图。传统中国木刻版画风格，
像古老占卜图谱中的一页：宣纸色纯平背景（精确色值 #F6F1E5，无纹理、无渐变、
无暗角），深墨色线描（#2A251D），允许少量朱砂红（#BF3F2C）指节纹作为点缀，
掌心留白干净。

构图：食指、中指、无名指三指伸直、相互平行、间距均匀、视觉等长；拇指在画面
左侧；小指自然偏短、位置略低；指节与掌纹清晰可辨；手占画面高度约 80%，四边
留白均匀。

严格禁止：任何文字、汉字、数字、标签、印章、水印；写实照片感、3D 渲染感、
透视与透视缩短；手指弯曲或相互并拢；首饰、写实指甲、手腕前臂入画。

输出：竖版 PNG，1024×1536。
```

## 实操提示

1. **多生成几张挑最好的**：挑"手指最直、间距最匀、没有文字"的那张。图像模型经常忍不住往画面里加字，有字的一律淘汰。
2. **透明底**：如果 GPT 用的图像工具支持透明背景，可以把背景要求换成 `transparent background`；不支持就用上面的纯色方案（色值一致时视觉上等于透明）。
3. **比例**：如果工具只给 1:1，也可以用，构图要求不变，我来裁。

## 图片到手后的交接流程

1. 存为 `仓库根目录\assets\palm.png`（文件名随意，告诉我即可）
2. ZCode 负责：把 SVG 手掌换成图片底图 → 对照图片重新标定六个宫位节点坐标（节点坐标是一个数组 `NODE_POS`，改数即可）→ 浏览器里重新跑一遍视觉验证和点击测试
3. 就算生成的手不完全符合要求（手指略弯、间距不匀），也能用——节点可以逐个校准，不必强求完美图片
