# 打包与发布指南（Android APK）

> 面向：想自己构建 APK、发新版、改代码的人。
> **只想装来用的人看 [README](../README.md) 就够了，直接去 [Releases](../../releases) 下载 APK，不用构建。**
>
> 本文以 Windows + Git Bash 为例写命令；macOS / Linux 把 `gradlew.bat` 换成 `./gradlew`、路径分隔符换一下即可。

---

## 0. 先选你要哪条路

| 你的目的 | 走哪条 | 需要装什么 |
|---|---|---|
| 只是想在手机上用 | 下载 [Releases](../../releases) 里的 APK | 一台安卓手机 |
| 想看/改界面，先跑起来 | 直接双击 `index.html`（或起个静态服务器） | 浏览器 |
| 想自己出 APK / 发新版 | 本文档 | Node 18+、JDK 17、Android SDK |

---

## 1. 技术栈与产物

- **纯前端**：没有框架、没有打包器，`index.html` + 几个 `.js` 就是全部代码，双击能跑。
- **Android 壳**：Capacitor 6（`com.qiazhi.xiaoliuren`），只做了「锁竖屏 + 状态栏 + 返回键 + 启动图」这点原生代码。
- **版本号**：`android/app/build.gradle` 里的 `versionCode`（整数，必须递增）与 `versionName`（给人看的，如 `2.1`）。
- **SDK 版本**：`minSdk 22`（Android 5.1+ 可装）、`compileSdk / targetSdk 34`（定义在同目录 `variables.gradle`）。
- **产物**：`android/app/build/outputs/apk/release/app-release.apk`，`node build-apk.js` 会把它拷成 `dist/掐指小六壬-v<版本>.apk`。

---

## 2. 环境准备（三个东西）

### 2.1 Node.js 18+（建议 20 LTS）

只用来跑 `sync-www.js` / `build-apk.js` / `cap sync`。

### 2.2 JDK 17 —— ⚠️ 最常踩的坑

**必须是 JDK 17**。Gradle 8.2.1 + AGP 8.2.1 跑不了 JDK 21+（报 `Unsupported class file major version` 之类）。

两条路，任选一条：

```bash
# 路线 A：让 JAVA_HOME 指向 JDK 17（临时生效示例，建议写进系统环境变量）
export JAVA_HOME="/c/Program Files/Java/jdk-17.0.1"
```

```properties
# 路线 B：不管 JAVA_HOME，在「用户级」Gradle 配置里钉死 JDK 17
# 文件：C:\Users\<你>\.gradle\gradle.properties（Linux/macOS：~/.gradle/gradle.properties）
org.gradle.java.home=C:/Program Files/Java/jdk-17.0.1
```

> ⚠️ **不要把 `org.gradle.java.home` 写进仓库里的 `android/gradle.properties`**。
> 那里写的是绝对路径，只对你自己这台机器有效，别人 clone 下来会因为路径不存在直接构建失败
> （本项目已经刻意把这行挪出去了，见 `docs/交接文档.md` 第六节）。
> 项目级 `gradle.properties` 优先级高于用户级，所以将来某个项目需要别的 JDK 时，在那里单独覆盖。

验证：

```bash
cd android && ./gradlew -version    # Windows: gradlew.bat -version
# 输出里 JVM 一行应显示 17.x
```

### 2.3 Android SDK（platform 34 + build-tools 34）

- 装了 Android Studio 的话，用 SDK Manager 勾 **Android API 34** 和 **Build-Tools 34.0.0** 即可。
- 只想用命令行：装 [commandline-tools](https://developer.android.com/studio#command-tools)，然后

  ```bash
  sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"
  sdkmanager --licenses        # 一路 y，不接受 license 构建会失败
  ```

- 让 Gradle 找到 SDK：设环境变量 `ANDROID_HOME`（或 `ANDROID_SDK_ROOT`），
  或者写进 `android/local.properties`：

  ```properties
  sdk.dir=C:/Users/<你>/AppData/Local/Android/Sdk
  ```

  > `android/local.properties` 是**本机私有**文件，已在 `.gitignore` 里，不要提交。

### 2.4 Gradle 不用自己装

`android/gradlew` 会自动下载 Gradle 8.2.1（约 100MB，只下一次，缓存在 `~/.gradle`）。
第一次构建还要下 AGP 等依赖，**总共 5–15 分钟属正常**，之后就快了。

---

## 3. 一条命令打包

```bash
# 依赖只装一次
npm install

# 出 release 包（会自动 sync-www.js → cap sync → gradle assembleRelease → 拷到 dist/）
node build-apk.js release

# 出 debug 包（自测用，体积大一点、可调试）
node build-apk.js debug
```

想手动分步执行（等价）：

```bash
node sync-www.js                 # 源码 → www/
npx cap sync android             # www/ → android/app/src/main/assets/public/ 并补齐 Capacitor 生成文件
cd android && ./gradlew assembleRelease     # Windows: gradlew.bat assembleRelease
```

**改了网页文件（`index.html` / `app.js` / `*.js` / `assets/`）就必须重新走这套流程再打包**，
APK 里的网页是打进包里的静态资源，**没有热更新**：不重新打包，手机上永远是旧界面。

### 关于 `--copy-only`

本仓库作者的机器上有个环境怪癖（`npx cap sync android` 会误删 `capacitor-cordova-android-plugins/`，见 `docs/交接文档.md` 第六节），
所以提供了一条绕行参数：

```bash
node build-apk.js release --copy-only   # = sync-www.js + 手动拷贝到 android assets，跳过 cap sync
```

它只能在「已经成功跑过一次 `cap sync`、`android/app/src/main/assets/` 下的 Capacitor 生成文件都在」的机器上用。
全新 clone 的仓库请老老实实跑不带参数的版本。

---

## 4. 签名 —— 决定「能不能覆盖安装」

### 4.1 为什么签名重要

安卓只允许**同一个包名 + 同一个签名**的新版本覆盖安装。签名不同，安装时会提示失败或「应用未安装」，
用户必须先卸载旧版（**卸载会清掉本地记录**：课例、练习记录都存在 App 的 localStorage 里）。

所以：**官方发布包的 keystore 一旦丢失，所有老用户就只能卸载重装。**

### 4.2 本仓库怎么处理签名

`android/keystore.jks`（发布签名文件）与 `android/keystore.properties`（密码）**都不在仓库里**，
`.gitignore` 已忽略。`android/app/build.gradle` 按下面的顺序取签名配置：

| 顺序 | 来源 | 用途 |
|---|---|---|
| 1 | `android/keystore.properties` | 本机日常构建（作者用 / 你换成自己的 keystore 也用这个） |
| 2 | 环境变量 `XLR_KEYSTORE_FILE` / `XLR_KEYSTORE_PASSWORD` / `XLR_KEY_ALIAS` / `XLR_KEY_PASSWORD` | CI（GitHub Actions Secrets） |
| 3 | 都没有 → **回退用 debug 签名** | 保证任何人 clone 下来都能构建出可安装的包，控制台会打印提醒 |

`android/keystore.properties` 格式（`storeFile` 相对于 `android/app/` 目录）：

```properties
storeFile=../keystore.jks
storePassword=你的密码
keyAlias=你的别名
keyPassword=你的密码
```

### 4.3 用自己的签名构建（推荐给二次开发者）

```bash
# 生成你自己的 keystore（有效期 100 年，按提示设置密码与姓名）
keytool -genkeypair -v -keystore android/keystore.jks -alias mykey \
        -keyalg RSA -keysize 2048 -validity 36500
# 然后按 4.2 的格式写 android/keystore.properties，再 node build-apk.js release
```

⚠️ 这样构建出来的包**不能覆盖安装官方包**（签名不同），装之前要先卸载官方版，本地记录会丢。
如果你想跟官方包混装，只能用作者的签名（作者不公开，原因见下）。

### 4.4 为什么不把 keystore 一起开源

`.jks` + 密码一旦公开，**任何人都能签出「和官方一模一样」的 APK**，冒充官方发更新包；
安卓无法区分，用户也看不出来。签名密钥是不可撤销的——真出事了只能换包名/换签名，让所有人卸载重装。

如果你的目标只是「别人不用自己打包」，那**不需要公开签名**：把官方 APK 传成 Release 资产就够了（见第 6 节）。

反过来，如果你就是想让所有人都能打出「可覆盖安装」的包（有些小项目会这么做），
要接受上面这个后果；那种情况下把 keystore 与密码一起提交、并在 README 里说清楚即可。

**无论哪种方案：keystore 与密码都要多处备份**（密码管理器 / 私有仓库 / 离线 U 盘），丢了不可恢复。

---

## 5. 发新版的完整流程（清单）

1. 改代码（改**源文件**，不要改 `www/`、`questions.js` 这些生成物）。
2. 跑测试，两个都要绿：
   ```bash
   node test.js        # 引擎/历法/数据锚点，28/28
   node smoke-test.js  # jsdom 界面冒烟，25/25（改了 app.js / index.html 必跑）
   ```
3. 改版本号：`android/app/build.gradle` 里 `versionCode` **+1**（不改的话手机上装不上新包），`versionName` 改成新版本号。
4. `node build-apk.js release` → 产物在 `dist/`。
5. 装机验一遍（真机或模拟器）：`adb install -r dist/掐指小六壬-v<版本>.apk`。
6. 打 tag 发 Release（见第 6 节）。

---

## 6. 发布：让所有人能直接下载 APK

### 6.1 手动发（最直观）

GitHub 仓库页 → **Releases** → **Draft a new release**：

- Tag：`v2.2`（建议与 `versionName` 一致）
- Title：`v2.2`
- 说明：写这一版改了什么（可直接抄 `CHANGELOG.md` 对应段落）
- 附件：把 `dist/掐指小六壬-v2.2.apk` 拖进去
- 发布

有 `gh` CLI 的话一条命令：

```bash
gh release create v2.2 "dist/掐指小六壬-v2.2.apk" --title "v2.2" --notes "见 CHANGELOG.md"
```

### 6.2 自动发（推荐，配置一次以后省事）

仓库里带了 `.github/workflows/android-apk.yml`：

- **打 tag 即发布**：`git tag v2.2 && git push origin v2.2` → Actions 自动构建 → 自动挂到该 tag 的 Release 上。
- **手动触发**：Actions 页 → *Build APK* → *Run workflow* → 构建完在 Artifacts 里下载（不发布 Release）。
- **签名**：配置了下面的 Secrets 就用你的正式签名，没配就用 debug 签名出包（只适合测试）。

| Secret 名 | 内容 |
|---|---|
| `KEYSTORE_BASE64` | `android/keystore.jks` 的 base64 |
| `KEYSTORE_PASSWORD` | store 密码 |
| `KEY_ALIAS` | 别名 |
| `KEY_PASSWORD` | key 密码 |

生成 base64（**别把结果提交进仓库**）：

```bash
base64 -w0 android/keystore.jks > ks.b64        # Git Bash / Linux / macOS
```

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("android\keystore.jks")) | Set-Content ks.b64
```

然后 GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret，逐个添加。

### 6.3 APK 怎么分发才合适：Releases，不是提交进 git

**可以上传 APK 到 GitHub，但推荐放在 Releases 附件里，不要 `git add` 进代码历史**：

| 方式 | 是否可行 | 说明 |
|---|---|---|
| Release 附件（推荐） | ✅ | 单文件上限 2GB，下载页有版本记录，仓库代码历史不受影响 |
| 直接提交进仓库 | ⚠️ 可以但不建议 | 单文件上限 100MB（超 50MB 会警告）。二进制文件在 git 里**每改一次就永久多存一份**，`git clone` 会越来越慢，且仓库体积只增不减 |
| Git LFS | ⚠️ | 能放，但等于给克隆的人增加依赖和流量配额，对「下载即用」没好处 |

所以本仓库的做法是：**APK 一律走 Releases，`dist/` 与 `*.apk` 都在 `.gitignore` 里**。
用户从 Releases 点一下就下完，不用 clone、不用构建。

> 如果你确实希望「clone 仓库就自带最新 APK」（比如方便国内镜像/离线传播），
> 可以把 `dist/xxx.apk` 用 `git add -f` 强制加进来并删掉 `.gitignore` 里的 `*.apk`，
> 但要清楚上面那条代价。

### 6.4 顺带一提：网页版也能一键部署

代码本身就是静态网页，`www/` 目录可以直接丢到任何静态托管（GitHub Pages / Vercel / Netlify / 自己的服务器）。
仓库里带了 `.github/workflows/pages.yml`，在 Settings → Pages 里把 Source 选成 **GitHub Actions** 后，
每次 push 到 `main` 都会自动更新在线版；不想用 Pages 就在仓库设置里关掉该 workflow。

---

## 7. 常见问题（FAQ）

**Q：卡在 `Downloading gradle-8.2.1-bin.zip`**
首次构建要下约 100MB 的 Gradle 发行版，网络差就会卡。让它下完（别再中断，否则缓存半截更麻烦）；
或者装好 Gradle 后用本机缓存构建。国内可给 Gradle 配镜像（`~/.gradle/init.gradle` 里替换 repositories 为阿里云镜像）。

**Q：`Unsupported class file major version 65` / `Android Gradle plugin requires Java 17`**
JDK 版本不对，见 2.2。注意改了 `JAVA_HOME` 要重开终端，Gradle 若已起 daemon 需 `./gradlew --stop`。

**Q：`SDK location not found`**
没配 `ANDROID_HOME` 或 `android/local.properties`，见 2.3。

**Q：`sdkmanager --licenses` 没接受 → 构建报 licence 错误**
重新执行 `sdkmanager --licenses`，全部选 y。

**Q：`npx cap sync android` 报错并把 `capacitor-cordova-android-plugins/` 删掉了**
本仓库作者的机器上有这个「删除拦截」环境问题（见 `docs/交接文档.md` 第六节 7），
换一台机器一般不会遇到。真遇到了：用 `node build-apk.js release --copy-only` 绕行（前提是生成文件还在），
或者从 `node_modules/@capacitor/cli/assets/capacitor-cordova-android-plugins.tar.gz` 恢复目录。

**Q：装完打开还是旧界面**
三连排查：① 有没有跑 `cap sync`（`www/` 里的旧文件被打进包）；② `versionCode` 有没有 +1；
③ 手机上是否真的装了新包（`adb install -r`，或先卸载再装）。

**Q：手机提示「应用未安装」/「签名不一致」**
你用的签名和已安装的那个不一样。卸载旧版再装（会丢本地记录），或者换回同一个 keystore。

**Q：为什么 APK 有 3MB，网页明明只有 300KB？**
Capacitor 的 Android 壳（WebView 桥、AndroidX、启动图等）占了大头，网页资源本身只有几百 KB。

**Q：怎么换图标 / 启动图**
图标：改 `make-icons.js` 里的颜色与图形，`node make-icons.js` 重新生成全套 mipmap。
启动图：替换 `android/app/src/main/res/drawable*/splash.png`。

**Q：应用联网吗？**
不联网。没有后端、没有账号、没有任何外部请求，数据只存在本机 localStorage。
`AndroidManifest.xml` 里的 `INTERNET` 权限是 Capacitor 模板默认带的，本项目没用到，介意可以自行删除后重新打包（删了要真机验证一遍）。

**Q：Git Bash 里 `cmd //c "gradlew.bat assembleRelease"` 好像没执行？**
Git Bash 调 `.bat` 有坑，别绕：用 `node build-apk.js`（内部用 Node 起进程，跨平台），
或直接在 `cmd`/PowerShell 里进 `android/` 目录跑 `gradlew.bat assembleRelease`。

**Q：需要装 Android Studio 吗？**
不需要。只要 JDK 17 + Android SDK（platform 34 / build-tools 34）+ Node 就能打包；
装了 Android Studio 只是省去手装 SDK 的步骤，也方便调试。

---

## 8. 打包相关文件速查

| 路径 | 作用 | 能改吗 |
|---|---|---|
| `index.html` / `app.js` / `engine.js` / `palaces.js` / `combos.js` / `divine.js` | 应用源码 | ✅ 改这里 |
| `questions/*.json` → `questions.json` → `questions.js` | 题库源 → 合并产物 → 运行时文件 | 改源 JSON，产物用脚本生成 |
| `sync-www.js` | 生成 `www/` | 一般不动 |
| `build-apk.js` | 一键打包 | 一般不动 |
| `android/app/build.gradle` | versionCode / versionName / 签名读取 | ✅ 改版本号 |
| `android/keystore.properties` | 本机签名密码 | 私有，不进仓库 |
| `www/`、`questions.js`、`android/app/src/main/assets/public/` | **生成物** | ❌ 别手改，会被覆盖 |
| `dist/` | 打包输出 | 忽略，不进仓库 |
