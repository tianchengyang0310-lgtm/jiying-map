# 迹影地图 Android App

离线照片管理 + 高德地图浏览，APK 直接安装到手机。

## 第一步：申请高德地图 API Key

1. 打开 https://console.amap.com/ 注册/登录
2. 进入「应用管理 → 我的应用」→ 创建新应用
3. 添加 Key，「服务平台」选 **Web端(JS API)**
4. 复制 Key 和安全密钥

## 第二步：填入 API Key

编辑 `www/index.html`，找到 `_AMAP_KEY` 和 `securityJsCode`，替换为你的 Key 和安全密钥。

## 第三步：构建 APK

### 方案 A：用 GitHub Actions 自动构建（推荐，无需装任何东西）

1. 把整个 `app/` 文件夹上传到一个 GitHub 仓库
2. 推送代码后，GitHub Actions 自动开始构建
3. 打开仓库的 Actions 页面，下载构建好的 APK
4. 把 APK 传到手机，安装即可

### 方案 B：本地构建

```bash
# 进入 app 目录
cd app

# 安装依赖
npm install

# 初始化 Android 项目
npx cap add android

# 同步代码到 Android 项目
npx cap sync

# 用 Android Studio 打开并构建
npx cap open android
```

需要安装：Node.js、Android Studio、Android SDK 35。

## 使用说明

1. **安装 APK 到手机** — 允许「安装未知来源应用」
2. **打开 App** — 直接进入主界面，无需密码
3. **导入照片** — 点击右上角「+ 导入照片」，从相册批量选择
4. **时间线浏览** — 照片按拍摄日期分组（优先 EXIF），点击查看大图
5. **地图浏览** — 切换到地图 Tab，查看有 GPS 的照片位置分布
6. **查看详情** — 显示拍摄日期、时间、相机型号、GPS 坐标、逆地理地址
7. **添加备注** — 点击照片，在详情页写下备注并保存
8. **离线使用** — 所有照片数据本地存储（IndexedDB + localStorage），没网也能看

## 注意

- 高德地图需要网络加载瓦片，离线时地图只显示标记点
- 照片和缩略图以 Base64 存储在手机本地（IndexedDB），不上传任何服务器
- GPS 坐标自动校验，0,0 和非法值会被过滤
- 完全离线可用（地图部分除外）
- 个人使用，不上架应用商店

## 技术说明

- Capacitor 6 + 高德地图 JS API 2.0
- IndexedDB 存储照片 Base64 数据 + 缩略图
- localStorage 存储元数据和备注
- Canvas 生成缩略图（Base64）+ 照片压缩（1920px）
- 客户端 EXIF 解析（日期/GPS/相机型号）
- GPS 坐标合法性校验（拒绝 Infinity / NaN / 0,0 / 越界）
- AMap.Geocoder 逆地理编码获取地址
- AMap.MarkerClusterer 地图点位聚合
- 高德坐标顺序：[lng, lat]
- 安卓 15 / API 35+
